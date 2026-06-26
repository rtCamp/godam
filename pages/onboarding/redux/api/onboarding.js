/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * Internal dependencies
 */
import { config } from '../../utils/constants';

const restURL = config.restUrl || window.godamRestRoute?.url || window.wpApiSettings?.root || '/wp-json/';
const base = window.pathJoin ? window.pathJoin( [ restURL, '/godam/v1/onboarding/' ] ) : `${ restURL }godam/v1/onboarding/`;

/**
 * Every onboarding call goes through the WP proxy (`/godam/v1/onboarding/*`),
 * which attaches the godam-core auth (the JWT is held server-side and never
 * reaches the browser) and unwraps Frappe's `message` wrapper.
 */
const baseQuery = fetchBaseQuery( {
	baseUrl: base,
	prepareHeaders: ( headers ) => {
		headers.set( 'Content-Type', 'application/json' );
		headers.set( 'X-WP-Nonce', config.nonce || window.wpApiSettings?.nonce || '' );
		return headers;
	},
} );

const post = ( url, body ) => ( { url, method: 'POST', body } );

export const onboardingAPI = createApi( {
	reducerPath: 'onboardingAPI',
	baseQuery,
	endpoints: ( builder ) => ( {
		checkUserExists: builder.mutation( { query: ( email ) => post( 'check-user-exists', { email } ) } ),
		signup: builder.mutation( { query: ( body ) => post( 'signup', body ) } ),
		passwordLogin: builder.mutation( { query: ( body ) => post( 'password-login', body ) } ),
		googleOauthUrl: builder.mutation( { query: ( wpOrigin ) => post( 'google-oauth-url', { wp_origin: wpOrigin } ) } ),
		exchangeOauthCode: builder.mutation( { query: ( code ) => post( 'exchange-oauth-code', { code } ) } ),
		listOrganizations: builder.mutation( { query: () => post( 'list-organizations', {} ) } ),
		getOrganizationApiKey: builder.mutation( { query: ( organization ) => post( 'organization-api-key', { organization } ) } ),
		verifyLicenseKey: builder.mutation( { query: ( apiKey ) => post( 'verify-license-key', { api_key: apiKey } ) } ),
		resetPassword: builder.mutation( { query: ( email ) => post( 'reset-password', { user: email } ) } ),
		resendVerification: builder.mutation( { query: ( email ) => post( 'resend-verification', { email } ) } ),
	} ),
} );

export const {
	useCheckUserExistsMutation,
	useSignupMutation,
	usePasswordLoginMutation,
	useGoogleOauthUrlMutation,
	useExchangeOauthCodeMutation,
	useListOrganizationsMutation,
	useGetOrganizationApiKeyMutation,
	useVerifyLicenseKeyMutation,
	useResetPasswordMutation,
	useResendVerificationMutation,
} = onboardingAPI;
