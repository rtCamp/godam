/**
 * Unit tests for the tour controller's rewind (`backTo`) handling.
 */

/**
 * Internal dependencies
 */
import * as tour from './controller';
import { getSteps } from './steps';

const mockHighlight = jest.fn();

jest.mock( 'driver.js', () => ( {
	driver: () => ( { highlight: mockHighlight, destroy: jest.fn(), refresh: jest.fn(), getState: jest.fn() } ),
} ) );
jest.mock( './steps', () => ( { getSteps: jest.fn() } ) );
jest.mock( './state', () => ( {
	TOUR_STATES: { COMPLETED: 'completed', DISMISSED: 'dismissed' },
	setTourState: jest.fn(),
	writeSession: jest.fn(),
	clearSession: jest.fn(),
} ) );
jest.mock( './dom', () => ( {
	EVENTS: {},
	$visible: ( selector ) => global.document.querySelector( selector ),
	waitFor: ( predicate ) => Promise.resolve( predicate() || null ),
} ) );

// Let the async show() chain settle.
const flush = async () => {
	for ( let i = 0; i < 10; i++ ) {
		await Promise.resolve();
	}
};

const highlighted = () => mockHighlight.mock.calls.map( ( [ options ] ) => options.element.id );

describe( 'media library tour: abandoned actions', () => {
	beforeEach( () => {
		mockHighlight.mockClear();
		document.body.innerHTML = '<div id="new-folder"></div><div id="after"></div>';
	} );

	afterEach( () => tour.destroy() );

	const nameFolder = {
		id: 'name-folder',
		element: '#folder-modal',
		text: 'Name it',
		abortWhen: () => true,
		backTo: 'new-folder',
	};

	it( 'skips a step whose start step was skipped, instead of looping', async () => {
		getSteps.mockReturnValue( [
			{ id: 'new-folder', element: '#new-folder', text: 'Create', when: () => false },
			nameFolder,
			{ id: 'after', element: '#after', text: 'Next', showNext: true },
		] );

		expect( () => tour.start() ).not.toThrow();
		await flush();

		expect( highlighted() ).toEqual( [ 'after' ] );
	} );

	it( 'still rewinds to the start step when it is available', async () => {
		getSteps.mockReturnValue( [
			{ id: 'new-folder', element: '#new-folder', text: 'Create' },
			nameFolder,
			{ id: 'after', element: '#after', text: 'Next', showNext: true },
		] );

		tour.start( { stepId: 'name-folder' } );
		await flush();

		expect( highlighted() ).toEqual( [ 'new-folder' ] );
	} );
} );
