import { NextRequest, NextResponse } from 'next/server';
import { whopSdk } from '@/lib/whop-sdk';

// Wrapper to ensure we NEVER return empty responses
async function handleCheckoutRequest(request: NextRequest) {
  const startTime = Date.now();
  let errorDetails: any = {};
  
  try {
    const userId = request.headers.get('X-User-ID');
    console.log('=== CHECKOUT API CALLED ===');
    console.log('User ID:', userId);
    console.log('Headers:', Object.fromEntries(request.headers.entries()));

    if (!userId) {
      console.log('ERROR: No user ID provided');
      return NextResponse.json({ 
        error: 'User ID is required',
        debug: { hasUserId: false }
      }, { status: 400 });
    }

    // CHECKLIST ITEM 4: Environment & redirect setup validation
    const envCheck = {
      hasAppId: !!process.env.NEXT_PUBLIC_WHOP_APP_ID,
      hasApiKey: !!process.env.WHOP_API_KEY,
      hasCompanyId: !!process.env.NEXT_PUBLIC_WHOP_COMPANY_ID,
      hasAgentUserId: !!process.env.NEXT_PUBLIC_WHOP_AGENT_USER_ID,
      hasProductId: !!process.env.NEXT_PUBLIC_WHOP_PRODUCT_ID,
      hasDeployUrl: !!process.env.DEPLOY_URL,
      appId: process.env.NEXT_PUBLIC_WHOP_APP_ID,
      companyId: process.env.NEXT_PUBLIC_WHOP_COMPANY_ID,
      agentUserId: process.env.NEXT_PUBLIC_WHOP_AGENT_USER_ID,
      productId: process.env.NEXT_PUBLIC_WHOP_PRODUCT_ID,
      deployUrl: process.env.DEPLOY_URL,
    };
    
    console.log('=== ENVIRONMENT CHECKLIST VALIDATION ===');
    console.log('Environment check:', envCheck);
    
    // Validate critical environment variables
    const missingCritical = [];
    if (!envCheck.hasAppId) missingCritical.push('NEXT_PUBLIC_WHOP_APP_ID');
    if (!envCheck.hasApiKey) missingCritical.push('WHOP_API_KEY');
    if (!envCheck.hasCompanyId) missingCritical.push('NEXT_PUBLIC_WHOP_COMPANY_ID');
    
    if (missingCritical.length > 0) {
      console.log('ERROR: Missing critical environment variables:', missingCritical);
      return NextResponse.json({ 
        error: 'Whop configuration incomplete',
        details: `Missing: ${missingCritical.join(', ')}`,
        debug: envCheck
      }, { status: 500 });
    }
    
    // Validate API key format
    if (envCheck.hasApiKey) {
      const apiKey = process.env.WHOP_API_KEY!;
      if (apiKey.startsWith('pk_')) {
        console.error('❌ API Key appears to be a public key (starts with pk_). Use a secret key for server-side operations.');
        return NextResponse.json({ 
          error: 'Invalid API key type',
          details: 'API key appears to be a public key. Use a secret key for server-side operations.',
          debug: envCheck
        }, { status: 500 });
      }
      console.log('✅ API Key format appears correct (not a public key)');
    }

    console.log('Creating charge for user:', userId);
    
    const apiKey = process.env.WHOP_API_KEY;
    let companyId = process.env.NEXT_PUBLIC_WHOP_COMPANY_ID;

    // CHECKLIST ITEM 1: Verify API Key has proper permissions and get Company ID
    console.log('=== CHECKING API KEY PERMISSIONS AND COMPANY ID ===');
    
    // Verify API key works and get company ID using GET /v2/me or /v5/company/overview
    let companyIdVerified = false;
    try {
      // Try the recommended /v2/me endpoint first
      const meResponse = await fetch('https://api.whop.com/api/v2/me', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('API Key validation - /v2/me status:', meResponse.status);
      
      if (meResponse.ok) {
        const meData = await meResponse.json();
        console.log('API Key validation successful:', { 
          userId: meData.id,
          hasCompany: !!meData.company_id,
          companyId: meData.company_id 
        });
        
        if (meData.company_id) {
          companyId = meData.company_id;
          companyIdVerified = true;
          console.log('✅ Company ID verified from /v2/me:', companyId);
        }
      } else {
        console.error('API Key validation failed:', await meResponse.text());
        errorDetails.apiKeyValidation = {
          status: meResponse.status,
          message: 'Failed to validate API key with /v2/me endpoint'
        };
      }
    } catch (error) {
      console.error('API Key validation error:', error);
      errorDetails.apiKeyValidation = { error: error };
    }
    
    // Fallback: Get company ID from companies endpoint if not verified
    if (!companyIdVerified && !companyId) {
      try {
        console.log('Trying fallback: /api/v2/companies endpoint');
        const companyResponse = await fetch('https://api.whop.com/api/v2/companies', {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        });
        
        console.log('Companies endpoint status:', companyResponse.status);
        
        if (companyResponse.ok) {
          const companiesData = await companyResponse.json();
          console.log('Companies data:', companiesData);
          
          if (companiesData.data && companiesData.data.length > 0) {
            companyId = companiesData.data[0].id;
            console.log('✅ Company ID fetched from companies endpoint:', companyId);
          }
        } else {
          console.error('Failed to fetch companies:', await companyResponse.text());
        }
      } catch (error) {
        console.error('Failed to fetch company ID:', error);
        errorDetails.companyFetch = { error: error };
      }
    }

    // CHECKLIST ITEM 2: Verify App ID has access and is properly configured
    console.log('=== CHECKING APP ID ACCESS ===');
    const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID;
    
    if (appId) {
      try {
        const appResponse = await fetch(`https://api.whop.com/api/v2/apps/${appId}`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        });
        
        console.log('App ID validation status:', appResponse.status);
        
        if (appResponse.ok) {
          const appData = await appResponse.json();
          console.log('✅ App ID validated:', {
            appId: appData.id,
            appName: appData.name,
            companyId: appData.company_id,
            matchesOurCompany: appData.company_id === companyId
          });
          
          // Verify the app belongs to our company
          if (appData.company_id && appData.company_id !== companyId) {
            console.warn('⚠️ App belongs to different company:', {
              appCompanyId: appData.company_id,
              ourCompanyId: companyId
            });
            errorDetails.appCompanyMismatch = {
              appCompanyId: appData.company_id,
              ourCompanyId: companyId
            };
          }
        } else {
          console.error('App ID validation failed:', await appResponse.text());
          errorDetails.appValidation = {
            status: appResponse.status,
            message: 'Failed to validate app ID'
          };
        }
      } catch (appError) {
        console.error('App ID validation error:', appError);
        errorDetails.appValidation = { error: appError };
      }
    } else {
      console.error('❌ App ID not configured');
      errorDetails.appValidation = { error: 'App ID not found in environment variables' };
    }

    // Try multiple API endpoints and approaches
    let chargeResult = null;

    // Method 1: Try SDK with proper configuration
    console.log('=== METHOD 1: SDK APPROACH ===');
    try {
      console.log('Trying SDK chargeUser method...');
      console.log('SDK config:', {
        appId: process.env.NEXT_PUBLIC_WHOP_APP_ID,
        hasApiKey: !!process.env.WHOP_API_KEY,
        companyId: companyId,
        userId: userId
      });
      
      // Try with user and company context
      const sdkWithContext = companyId 
        ? whopSdk.withCompany(companyId).withUser(userId)
        : whopSdk.withUser(userId);
      
      const sdkResult = await sdkWithContext.payments.chargeUser({
        amount: 1000,
        currency: "usd",
        userId: userId,
        metadata: {
          type: 'no_cooldown_upgrade',
          productId: 'prod_Sml5QytP89dtj',
        },
      });

      console.log('SDK result:', JSON.stringify(sdkResult, null, 2));

      if (sdkResult?.inAppPurchase) {
        console.log('SUCCESS: SDK returned inAppPurchase');
        return NextResponse.json(sdkResult.inAppPurchase);
      }

      // SDK might return the charge data in different format
      if (sdkResult && typeof sdkResult === 'object' && 'id' in sdkResult) {
        chargeResult = sdkResult as any;
        console.log('SUCCESS: SDK returned charge result');
      }
    } catch (sdkError: any) {
      console.error('SDK method failed:', sdkError);
      errorDetails.sdkError = {
        message: sdkError?.message || sdkError?.toString() || 'Unknown SDK error',
        code: sdkError?.code || sdkError?.status || 'unknown',
        response: sdkError?.response?.data || sdkError?.response || 'no response data'
      };
      console.error('SDK error details:', errorDetails.sdkError);
    }

    // Method 2: Try direct API call to charges endpoint
    if (!chargeResult) {
      console.log('=== METHOD 2: DIRECT API APPROACH ===');
      try {
        console.log('Trying direct charges API...');
        
        // CHECKLIST ITEM 3: Correct payload + endpoint for charge creation
        const chargePayload = {
          amount: 1000, // $10.00 in cents
          currency: 'usd',
          metadata: {
            type: 'no_cooldown_upgrade',
            productId: process.env.NEXT_PUBLIC_WHOP_PRODUCT_ID || 'prod_Sml5QytP89dtj',
          },
        };
        
        // Add required fields based on Whop API documentation
        if (companyId) {
          (chargePayload as any).company_id = companyId;
        }
        
        // Add app_id if required
        const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID;
        if (appId) {
          (chargePayload as any).app_id = appId;
        }
        
        // For charges, we typically need user_id or member_id
        (chargePayload as any).user_id = userId;
        
        console.log('Charge payload:', JSON.stringify(chargePayload, null, 2));
        
        // Try multiple potential endpoints as recommended
        const endpoints = [
          'https://api.whop.com/api/v2/payments/charges',
          'https://api.whop.com/api/v2/charges',
          'https://api.whop.com/v2/payments/charges'
        ];
        
        let chargesResponse;
        let successfulEndpoint;
        
        for (const endpoint of endpoints) {
          try {
            console.log(`Trying endpoint: ${endpoint}`);
            chargesResponse = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(chargePayload),
            });
            
            console.log(`${endpoint} response status:`, chargesResponse.status);
            
            // If we get a response that's not 404, use this endpoint
            if (chargesResponse.status !== 404) {
              successfulEndpoint = endpoint;
              break;
            }
          } catch (endpointError) {
            console.log(`Endpoint ${endpoint} failed:`, endpointError);
            continue;
          }
        }
        
        if (!chargesResponse) {
          throw new Error('All charge endpoints failed');
        }

        console.log('Charges API response status:', chargesResponse.status);
        console.log('Charges API response headers:', Object.fromEntries(chargesResponse.headers.entries()));

        const responseText = await chargesResponse.text();
        console.log('Charges API response body (raw):', responseText);

        if (chargesResponse.ok) {
          try {
            chargeResult = JSON.parse(responseText);
            console.log('Charges API result (parsed):', chargeResult);
          } catch (parseError) {
            console.error('Failed to parse charges response:', parseError);
            errorDetails.chargesParseError = parseError;
          }
        } else {
          console.error('Charges API error response:', responseText);
          errorDetails.chargesApiError = {
            status: chargesResponse.status,
            statusText: chargesResponse.statusText,
            body: responseText
          };
        }
      } catch (chargesError: any) {
        console.error('Charges API failed:', chargesError);
        errorDetails.chargesError = {
          message: chargesError?.message || chargesError?.toString(),
          stack: chargesError?.stack
        };
      }
    }

    // Method 3: Try checkout creation endpoint
    if (!chargeResult) {
      try {
        console.log('Trying checkout creation API...');
        const checkoutResponse = await fetch('https://api.whop.com/api/v2/checkouts', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: 1000,
            currency: 'usd',
            user_id: userId,
            metadata: {
              type: 'no_cooldown_upgrade',
              productId: 'prod_Sml5QytP89dtj',
            },
            ...(companyId && { company_id: companyId }),
          }),
        });

        console.log('Checkout API response status:', checkoutResponse.status);

        if (checkoutResponse.ok) {
          const checkoutData = await checkoutResponse.json();
          console.log('Checkout API result:', checkoutData);
          
          // Convert checkout to charge-like format
          chargeResult = {
            id: checkoutData.id || checkoutData.checkout_id,
            checkout_url: checkoutData.checkout_url || checkoutData.url,
            amount: 1000,
            currency: 'usd',
            metadata: checkoutData.metadata || {
              type: 'no_cooldown_upgrade',
              productId: 'prod_Sml5QytP89dtj',
            }
          };
        } else {
          const errorText = await checkoutResponse.text();
          console.error('Checkout API error:', errorText);
        }
      } catch (checkoutError) {
        console.log('Checkout API failed:', checkoutError);
      }
    }

    // Create inAppPurchase object if we got any result
    if (chargeResult && chargeResult.id) {
      const inAppPurchase = {
        id: chargeResult.id,
        checkout_url: chargeResult.checkout_url || chargeResult.url || `https://whop.com/checkout/${chargeResult.id}`,
        amount: chargeResult.amount || 1000,
        currency: chargeResult.currency || 'usd',
        user_id: userId,
        company_id: companyId,
        metadata: chargeResult.metadata || {
          type: 'no_cooldown_upgrade',
          productId: 'prod_Sml5QytP89dtj',
        }
      };

      console.log('Created inAppPurchase object:', inAppPurchase);
      return NextResponse.json(inAppPurchase);
    }

    // If all methods failed, provide detailed error information
    console.error('=== ALL METHODS FAILED ===');
    console.error('Error details collected:', JSON.stringify(errorDetails, null, 2));
    
    const finalError = {
      error: 'All charge creation methods failed',
      details: 'See debug information for specific failures',
      debug: {
        hasCompanyId: !!process.env.NEXT_PUBLIC_WHOP_COMPANY_ID,
        hasAppId: !!process.env.NEXT_PUBLIC_WHOP_APP_ID,
        hasApiKey: !!process.env.WHOP_API_KEY,
        hasUserId: !!request.headers.get('X-User-ID'),
        companyId: process.env.NEXT_PUBLIC_WHOP_COMPANY_ID,
        appId: process.env.NEXT_PUBLIC_WHOP_APP_ID,
        duration: Date.now() - startTime,
        errorDetails: errorDetails,
        timestamp: new Date().toISOString()
      }
    };
    
    console.error('Returning final error response:', JSON.stringify(finalError, null, 2));
    
    try {
      return NextResponse.json(finalError, { status: 500 });
    } catch (jsonError) {
      console.error('Failed to return JSON response:', jsonError);
      return new Response('Internal Server Error', { status: 500 });
    }

  } catch (error: any) {
    console.error('=== TOP-LEVEL ERROR ===');
    console.error('Unexpected error in checkout API:', error);
    
    const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
    const errorResponse = {
      error: errorMessage,
      details: error?.stack || 'No stack trace available',
      debug: {
        hasCompanyId: !!process.env.NEXT_PUBLIC_WHOP_COMPANY_ID,
        hasAppId: !!process.env.NEXT_PUBLIC_WHOP_APP_ID,
        hasApiKey: !!process.env.WHOP_API_KEY,
        hasUserId: !!request.headers.get('X-User-ID'),
        companyId: process.env.NEXT_PUBLIC_WHOP_COMPANY_ID,
        appId: process.env.NEXT_PUBLIC_WHOP_APP_ID,
        duration: Date.now() - startTime,
        errorType: error?.constructor?.name || typeof error,
        errorDetails: errorDetails,
        timestamp: new Date().toISOString()
      }
    };
    
    console.error('Returning top-level error response:', JSON.stringify(errorResponse, null, 2));
    
    try {
      return NextResponse.json(errorResponse, { status: 500 });
    } catch (jsonError) {
      console.error('Failed to return JSON error response:', jsonError);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
}

// Export the wrapped function to ensure we always return proper responses
export async function POST(request: NextRequest) {
  try {
    return await handleCheckoutRequest(request);
  } catch (criticalError: any) {
    // This should NEVER happen, but just in case
    console.error('CRITICAL ERROR in checkout API wrapper:', criticalError);
    
    const emergencyError = {
      error: 'Critical server error',
      details: criticalError?.message || 'Unknown critical error',
      debug: {
        timestamp: new Date().toISOString(),
        errorType: criticalError?.constructor?.name || typeof criticalError,
        hasStack: !!criticalError?.stack
      }
    };
    
    console.error('Returning emergency error response:', JSON.stringify(emergencyError, null, 2));
    
    try {
      return NextResponse.json(emergencyError, { status: 500 });
    } catch (jsonError) {
      console.error('Even emergency JSON failed:', jsonError);
      return new Response('Critical Server Error', { status: 500 });
    }
  }
}
