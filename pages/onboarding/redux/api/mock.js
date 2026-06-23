/**
 * Mock baseQuery for the onboarding API.
 *
 * godam-core's auth endpoints are still rolling out to the develop
 * environment, so until they're live (and a Postman collection is shared)
 * this returns canned responses shaped exactly like the documented
 * api-reference *inner* payloads (the WP proxy unwraps Frappe's `message`
 * wrapper, so the SPA always sees the inner object).
 *
 * Toggled by `window.godamOnboarding.mock`; swapped for the real
 * `fetchBaseQuery` proxy in onboarding.js once the endpoints land.
 */

const delay = ( ms ) => new Promise( ( resolve ) => setTimeout( resolve, ms ) );

const fakeJwt = ( method ) => ( {
	token: 'mock.jwt.token',
	token_type: 'Bearer',
	auth_method: method,
	expires_in: 86400,
	expiry: '2026-12-31 00:00:00',
	user: 'demo@example.com',
} );

const handlers = {
	'check-user-exists': () => ( { exists: false } ),
	signup: ( body ) => ( {
		message: 'Account created. Please verify your email to continue.',
		user: body?.email || 'demo@example.com',
		organization: `${ body?.first_name || 'Demo' }'s Org`,
		verification_required: true,
		free_plan_provisioned: true,
	} ),
	'password-login': () => fakeJwt( 'password' ),
	'google-login': () => fakeJwt( 'google' ),
	'list-organizations': () => ( {
		organizations: [
			{ name: "Aon Smith's Workspace", organization_name: "Aon Smith's Workspace", role: 'Owner', plan: 'Premium' },
			{ name: "Aon Smith's Trial", organization_name: "Aon Smith's Trial", role: 'Admin', plan: 'Trial' },
		],
	} ),
	'organization-api-key': ( body ) => ( {
		organization: body?.organization || "Aon Smith's Workspace",
		role: 'Owner',
		api_key: 'MOCK-LICENSE-KEY-0000',
	} ),
	'verify-license-key': () => ( { status: 'success', message: 'License verified.' } ),
	'reset-password': () => ( { message: 'If that account exists, a reset link is on its way.' } ),
	'resend-verification': () => ( { message: 'Verification email re-sent.' } ),
};

/**
 * @param {Object} args        RTK Query request descriptor.
 * @param {string} args.url    Endpoint slug (relative to the proxy base).
 * @param {Object} [args.body] Request body.
 * @return {Promise<{data:Object}>} Canned response.
 */
export const mockBaseQuery = async ( args ) => {
	await delay( 500 );
	const url = typeof args === 'string' ? args : args.url;
	const body = typeof args === 'object' ? args.body : undefined;
	const handler = handlers[ url ];
	if ( ! handler ) {
		return { error: { status: 404, data: { message: `No mock for "${ url }"`, error_type: 'NotFound' } } };
	}
	return { data: handler( body ) };
};
