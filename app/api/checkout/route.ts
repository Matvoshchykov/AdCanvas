import { NextRequest, NextResponse } from 'next/server';
import { whopSdk } from '@/lib/whop-sdk';

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('X-User-ID');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (!process.env.NEXT_PUBLIC_WHOP_APP_ID || !process.env.WHOP_API_KEY) {
      return NextResponse.json({ error: 'Whop configuration incomplete' }, { status: 500 });
    }

    console.log('Creating charge for user:', userId);
    
    const apiKey = process.env.WHOP_API_KEY;
    let companyId = process.env.NEXT_PUBLIC_WHOP_COMPANY_ID;

    // Get company ID if not available
    if (!companyId) {
      try {
        const companyResponse = await fetch('https://api.whop.com/api/v2/companies', {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (companyResponse.ok) {
          const companiesData = await companyResponse.json();
          if (companiesData.data && companiesData.data.length > 0) {
            companyId = companiesData.data[0].id;
            console.log('Fetched company ID:', companyId);
          }
        }
      } catch (error) {
        console.log('Failed to fetch company ID:', error);
      }
    }

    // Try multiple API endpoints and approaches
    let chargeResult = null;

    // Method 1: Try SDK with proper configuration
    try {
      console.log('Trying SDK chargeUser method...');
      const sdkResult = await whopSdk.payments.chargeUser({
        amount: 1000,
        currency: "usd",
        userId: userId,
        metadata: {
          type: 'no_cooldown_upgrade',
          productId: 'prod_Sml5QytP89dtj',
        },
      });

      console.log('SDK result:', sdkResult);

      if (sdkResult?.inAppPurchase) {
        return NextResponse.json(sdkResult.inAppPurchase);
      }

      // SDK might return the charge data in different format
      if (sdkResult && typeof sdkResult === 'object' && 'id' in sdkResult) {
        chargeResult = sdkResult as any;
      }
    } catch (sdkError) {
      console.log('SDK method failed:', sdkError);
    }

    // Method 2: Try direct API call to charges endpoint
    if (!chargeResult) {
      try {
        console.log('Trying direct charges API...');
        const chargesResponse = await fetch('https://api.whop.com/api/v2/payments/charges', {
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

        console.log('Charges API response status:', chargesResponse.status);

        if (chargesResponse.ok) {
          chargeResult = await chargesResponse.json();
          console.log('Charges API result:', chargeResult);
        } else {
          const errorText = await chargesResponse.text();
          console.error('Charges API error:', errorText);
        }
      } catch (chargesError) {
        console.log('Charges API failed:', chargesError);
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

    // If all methods failed
    throw new Error('All charge creation methods failed - check API permissions and configuration');

  } catch (error) {
    console.error('Checkout error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : String(error);
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorStack,
        debug: {
          hasCompanyId: !!process.env.NEXT_PUBLIC_WHOP_COMPANY_ID,
          hasAppId: !!process.env.NEXT_PUBLIC_WHOP_APP_ID,
          hasApiKey: !!process.env.WHOP_API_KEY,
          hasUserId: !!request.headers.get('X-User-ID'),
        }
      },
      { status: 500 }
    );
  }
}
