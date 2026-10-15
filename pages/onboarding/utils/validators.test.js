/**
 * Internal dependencies
 */
import { isValidEmail, isValidPassword, passwordsMatch, validateSignup, isUserInputRejection } from './validators';

describe( 'onboarding validators', () => {
	it( 'validates email shape', () => {
		expect( isValidEmail( 'a@b.com' ) ).toBe( true );
		expect( isValidEmail( 'nope' ) ).toBe( false );
		expect( isValidEmail( '' ) ).toBe( false );
	} );

	it( 'enforces minimum password length', () => {
		expect( isValidPassword( '12345678' ) ).toBe( true );
		expect( isValidPassword( 'short' ) ).toBe( false );
	} );

	it( 'matches confirm password', () => {
		expect( passwordsMatch( 'abc', 'abc' ) ).toBe( true );
		expect( passwordsMatch( 'abc', 'xyz' ) ).toBe( false );
		expect( passwordsMatch( '', '' ) ).toBe( false );
	} );

	it( 'returns field errors for an empty signup form', () => {
		const errors = validateSignup( { firstName: '', email: '', password: '', confirm: '', tnc: false } );
		expect( Object.keys( errors ) ).toEqual( expect.arrayContaining( [ 'firstName', 'email', 'password', 'confirm', 'tnc' ] ) );
	} );

	it( 'returns no errors for a valid signup form', () => {
		const errors = validateSignup( { firstName: 'Jane', email: 'jane@doe.com', password: 'password1', confirm: 'password1', tnc: true } );
		expect( errors ).toEqual( {} );
	} );
} );

describe( 'isUserInputRejection', () => {
	it( 'treats GoDAM turning down the input as the user\'s own error', () => {
		[ 400, 401, 403, 409, 422 ].forEach( ( status ) => expect( isUserInputRejection( { status } ) ).toBe( true ) );
	} );

	it( 'treats outages, rate limits, missing routes and network errors as real failures', () => {
		[ 404, 408, 429, 500, 502, 503, 'FETCH_ERROR' ].forEach( ( status ) => expect( isUserInputRejection( { status } ) ).toBe( false ) );
		expect( isUserInputRejection( undefined ) ).toBe( false );
	} );
} );
