/**
 * The recorder after Gravity Forms renders a field's markup again.
 *
 * Over AJAX, Gravity Forms swaps a page's markup on every page change or failed submit and then
 * fires `gform_post_render`. Uppy binds its dashboard trigger once, when it is installed, so the
 * recorder has to move onto the new markup itself. These tests replace the markup the same way
 * and fire the same event.
 */

/**
 * Stand-ins for Uppy. The dashboard fake looks its trigger up once when it is installed and binds
 * that element only, as @uppy/dashboard does, so a button rendered later opens nothing by itself.
 */
jest.mock( '@uppy/core', () => class MockUppy {
	constructor() {
		this.plugins = {};
		this.files = [];
		this.handlers = {};
		global.mockUppyInstances.push( this );
	}

	use( Plugin, options ) {
		const plugin = new Plugin( this, options );
		this.plugins[ plugin.id ] = plugin;
		if ( plugin.install ) {
			plugin.install();
		}
		return this;
	}

	getPlugin( id ) {
		return this.plugins[ id ];
	}

	getFiles() {
		return this.files;
	}

	on( event, handler ) {
		this.handlers[ event ] = [ ...( this.handlers[ event ] || [] ), handler ];
		return this;
	}

	removeFile( id ) {
		this.files = this.files.filter( ( file ) => file.id !== id );
		( this.handlers[ 'file-removed' ] || [] ).forEach( ( handler ) => handler() );
	}
} );
jest.mock( '@uppy/dashboard', () => class MockDashboard {
	constructor( uppy, options ) {
		this.id = 'Dashboard';
		this.options = options;
		this.openModal = jest.fn();
		this.closeModal = jest.fn();
	}

	install() {
		global.document.querySelectorAll( this.options.trigger ).forEach( ( trigger ) => {
			trigger.addEventListener( 'click', this.openModal );
		} );
	}
} );
jest.mock( '@uppy/webcam', () => class MockWebcam {} );
jest.mock( '@uppy/screen-capture', () => class MockScreenCapture {} );
jest.mock( '@uppy/audio', () => class MockAudio {} );
jest.mock( '@uppy/golden-retriever', () => class MockGoldenRetriever {} );

const SAVED_FILES = JSON.stringify( { input_3: [ { uploaded_filename: 'clip.webm', temp_filename: 'abc_input_3_clip.webm' } ] } );

/**
 * Markup of one Record field as the Gravity Forms field class prints it.
 *
 * @param {string} buttonId The button id; the server makes a new one on every render.
 * @return {string} The field markup.
 */
const fieldMarkup = ( buttonId ) => `
	<input type="file" name="input_3" id="input_1_3" />
	<div id="uppy_container_1_3" class="uppy-video-upload" data-max-size="1000000" data-input-id="input_1_3"
		data-video-upload-button-id="${ buttonId }" data-file-selectors="webcam" data-max-duration="0">
		<button type="button" id="${ buttonId }" class="uppy-video-upload-button">Start Recording</button>
		<div id="uppy_preview_1_3" class="uppy-video-upload-preview"></div>
		<div id="uppy_filename_1_3" class="upp-video-upload-filename"></div>
	</div>`;

const pageMarkup = ( buttonId ) => `<div id="gform_page_1_2" class="gform_page">${ fieldMarkup( buttonId ) }</div>`;

const heldRecording = () => ( {
	id: 'uppy-clip',
	name: 'clip.webm',
	type: 'video/webm',
	source: 'Webcam',
	data: new Blob( [ 'recording' ], { type: 'video/webm' } ),
} );

let handlers = {};

/**
 * Loads the form, lets the recorder start as it does on page load, and gives it a recording.
 *
 * @param {Object}  options          Options.
 * @param {string}  options.buttonId The first render's button id.
 * @param {boolean} options.saved    Whether Gravity Forms holds a saved copy of the recording, as 2.9.18+ does after a page change.
 * @return {Object} The recorder's Uppy instance.
 */
const loadForm = ( { buttonId = 'uppy-video-upload-1', saved = true } = {} ) => {
	document.body.innerHTML = `
		<form id="gform_1">
			<input type="hidden" name="gform_uploaded_files" />
			${ pageMarkup( buttonId ) }
		</form>`;

	document.dispatchEvent( new Event( 'DOMContentLoaded' ) );
	jest.advanceTimersByTime( 100 );

	document.querySelector( '[name=gform_uploaded_files]' ).value = saved ? SAVED_FILES : '';

	const uppy = global.mockUppyInstances[ 0 ];
	uppy.files = [ heldRecording() ];
	return uppy;
};

/**
 * Replaces the page's markup the way Gravity Forms' AJAX page change does, then fires its event.
 *
 * @param {string} buttonId The new markup's button id.
 */
const rerenderPage = ( buttonId ) => {
	document.getElementById( 'gform_page_1_2' ).outerHTML = pageMarkup( buttonId );
};

const firePostRender = () => {
	( handlers.gform_post_render || [] ).forEach( ( handler ) => handler( {}, 1, 2 ) );
};

const click = ( id ) => document.getElementById( id ).dispatchEvent( new MouseEvent( 'click', { bubbles: true } ) );

beforeAll( () => {
	global.mockUppyInstances = [];
	global.URL.createObjectURL = jest.fn( () => 'blob:recording' );
	global.URL.revokeObjectURL = jest.fn();

	// Same hook surface as jQuery's `.on()`, kept in a table the tests can fire.
	global.jQuery = () => ( {
		on: ( name, handler ) => {
			handlers[ name ] = [ ...( handlers[ name ] || [] ), handler ];
		},
		ready: ( callback ) => callback(),
	} );

	require( './index' );
} );

beforeEach( () => {
	jest.useFakeTimers();
	handlers = {};
	global.mockUppyInstances.length = 0;
} );

afterEach( () => {
	jest.useRealTimers();
	document.body.innerHTML = '';
} );

describe( 'recorder after Gravity Forms renders the field again', () => {
	it( 'opens the dashboard from the first render\'s button', () => {
		const uppy = loadForm();

		click( 'uppy-video-upload-1' );

		expect( uppy.getPlugin( 'Dashboard' ).openModal ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'opens the dashboard from the new button after a page change', () => {
		const uppy = loadForm();

		rerenderPage( 'uppy-video-upload-1' );
		firePostRender();
		click( 'uppy-video-upload-1' );

		expect( uppy.getPlugin( 'Dashboard' ).openModal ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'follows a button id that changed between renders', () => {
		const uppy = loadForm( { buttonId: 'uppy-video-upload-1' } );

		rerenderPage( 'uppy-video-upload-4' );
		firePostRender();
		click( 'uppy-video-upload-4' );

		expect( uppy.getPlugin( 'Dashboard' ).openModal ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'binds the new button once however many times Gravity Forms fires the event', () => {
		const uppy = loadForm();

		rerenderPage( 'uppy-video-upload-1' );
		firePostRender();
		firePostRender();
		firePostRender();
		click( 'uppy-video-upload-1' );

		expect( uppy.getPlugin( 'Dashboard' ).openModal ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'keeps working through several page changes', () => {
		const uppy = loadForm();
		const { openModal } = uppy.getPlugin( 'Dashboard' );

		rerenderPage( 'uppy-video-upload-1' );
		firePostRender();
		click( 'uppy-video-upload-1' );

		rerenderPage( 'uppy-video-upload-2' );
		firePostRender();
		click( 'uppy-video-upload-2' );

		expect( openModal ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'leaves the markup alone while it is still on the page', () => {
		loadForm();

		firePostRender();

		expect( document.getElementById( 'uppy-video-upload-1' ).hasAttribute( 'uppy-click-attached' ) ).toBe( false );
		expect( document.querySelector( '#uppy_preview_1_3 video' ) ).toBeNull();
	} );

	it( 'shows the held recording on the new markup', () => {
		loadForm();

		rerenderPage( 'uppy-video-upload-1' );
		firePostRender();

		expect( document.querySelector( '#uppy_preview_1_3 video' ) ).not.toBeNull();
		expect( document.getElementById( 'uppy_filename_1_3' ).textContent ).toBe( 'clip.webm' );
	} );

	it( 'does not send a recording again when Gravity Forms already holds a copy', () => {
		loadForm();
		const sent = jest.fn();
		document.addEventListener( 'godamFormInputchange', sent );

		rerenderPage( 'uppy-video-upload-1' );
		firePostRender();
		document.removeEventListener( 'godamFormInputchange', sent );

		expect( sent ).not.toHaveBeenCalled();
		expect( document.getElementById( 'input_1_3' ).files ).toHaveLength( 0 );
	} );

	it( 'puts the recording on the new file input when Gravity Forms kept no copy', () => {
		global.DataTransfer = class {
			constructor() {
				this.files = [];
				this.items = { add: ( file ) => this.files.push( file ) };
			}
		};
		loadForm( { saved: false } );
		rerenderPage( 'uppy-video-upload-1' );
		// jsdom's file input has no settable `files`; browsers do.
		const input = document.getElementById( 'input_1_3' );
		Object.defineProperty( input, 'files', { configurable: true, writable: true, value: null } );

		firePostRender();

		expect( input.files ).toHaveLength( 1 );
		expect( input.files[ 0 ].name ).toBe( 'clip.webm' );
		delete global.DataTransfer;
	} );

	it( 'drops Gravity Forms\' saved copy when the recording is removed after the page change', () => {
		const uppy = loadForm();
		const savedFilesInput = document.querySelector( '[name=gform_uploaded_files]' );

		rerenderPage( 'uppy-video-upload-1' );
		firePostRender();
		document.querySelector( '.uppy-remove-recording-button' ).click();

		expect( uppy.getFiles() ).toHaveLength( 0 );
		expect( JSON.parse( savedFilesInput.value ) ).toEqual( {} );
		expect( document.querySelector( '#uppy_preview_1_3 video' ) ).toBeNull();
	} );

	it( 'waits while the field is not on the page and binds it when it comes back', () => {
		const uppy = loadForm();

		document.getElementById( 'gform_page_1_2' ).remove();
		expect( firePostRender ).not.toThrow();

		document.getElementById( 'gform_1' ).insertAdjacentHTML( 'beforeend', pageMarkup( 'uppy-video-upload-1' ) );
		firePostRender();
		click( 'uppy-video-upload-1' );

		expect( uppy.getPlugin( 'Dashboard' ).openModal ).toHaveBeenCalledTimes( 1 );
	} );
} );
