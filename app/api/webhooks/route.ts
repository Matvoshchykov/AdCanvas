import { waitUntil } from "@vercel/functions";
import { makeWebhookValidator } from "@whop/api";
import type { NextRequest } from "next/server";

const validateWebhook = makeWebhookValidator({
	webhookSecret: process.env.WHOP_WEBHOOK_SECRET ?? "ws_28dea0b8719ddf9f5685459097a4369d26bb1cedf91b6e973807b4b39d05a55b",
});

export async function POST(request: NextRequest): Promise<Response> {
	// Validate the webhook to ensure it's from Whop
	const webhookData = await validateWebhook(request);

	// Handle the webhook event
	if (webhookData.action === "payment.succeeded") {
		const { id, final_amount, amount_after_fees, currency, user_id, metadata } =
			webhookData.data;

		// final_amount is the amount the user paid
		// amount_after_fees is the amount that is received by you, after card fees and processing fees are taken out

		console.log(
			`Payment ${id} succeeded for ${user_id} with amount ${final_amount} ${currency}`,
			{ metadata }
		);

		// Handle no-cooldown upgrade if this is the correct payment type
		if (metadata?.type === 'no_cooldown_upgrade') {
			console.log(`Granting no-cooldown access to user ${user_id}`);
			// You can store this in your database here
			// For now, we'll just log it
		}

		// if you need to do work that takes a long time, use waitUntil to run it in the background
		waitUntil(
			potentiallyLongRunningHandler(
				user_id,
				final_amount,
				currency,
				amount_after_fees,
				metadata,
			),
		);
	}

	// Make sure to return a 2xx status code quickly. Otherwise the webhook will be retried.
	return new Response("OK", { status: 200 });
}

async function potentiallyLongRunningHandler(
	user_id: string | null | undefined,
	_amount: number,
	_currency: string,
	_amount_after_fees: number | null | undefined,
	metadata?: any,
) {
	// Handle no-cooldown upgrade processing
	if (metadata?.type === 'no_cooldown_upgrade' && user_id) {
		console.log(`Processing no-cooldown upgrade for user ${user_id}`);
		// Here you would typically:
		// 1. Update user's database record to grant no-cooldown access
		// 2. Send confirmation email
		// 3. Update any related services
		
		// For now, we'll just log the successful processing
		console.log(`No-cooldown access granted to user ${user_id}`);
	}
}
