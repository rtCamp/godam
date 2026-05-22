import { render, screen } from '@testing-library/react';

describe( 'jest harness', () => {
	it( 'renders a basic element via Testing Library', () => {
		render( <div data-testid="smoke">hello</div> );
		expect( screen.getByTestId( 'smoke' ) ).toHaveTextContent( 'hello' );
	} );

	it( 'has @testing-library/jest-dom matchers loaded', () => {
		render( <button disabled>nope</button> );
		expect( screen.getByRole( 'button' ) ).toBeDisabled();
	} );
} );
