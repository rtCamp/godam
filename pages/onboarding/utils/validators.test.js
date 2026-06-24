/**
 * Internal dependencies
 */
import { isValidEmail, isValidPassword, passwordsMatch, validateSignup } from './validators';

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
