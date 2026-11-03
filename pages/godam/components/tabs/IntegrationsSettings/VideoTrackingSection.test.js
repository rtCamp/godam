/**
 * Unit tests for the "Video-view tracking" section: the site switch is shown only
 * when it can take effect, since GoDAM Central's tracking switch is the master.
 */

/**
 * WordPress dependencies
 */
import { renderToString } from '@wordpress/element';

/**
 * Internal dependencies
 */
import VideoTrackingSection from './VideoTrackingSection';

// Only the output matters here; the real components pull in a second copy of React.
jest.mock( '@wordpress/components', () => ( {
	CardBody: ( { children } ) => <div>{ children }</div>,
	CardDivider: () => <hr />,
	Notice: ( { children } ) => <div className="notice">{ children }</div>,
	ExternalLink: ( { children, href } ) => <a href={ href }>{ children }</a>,
	ToggleControl: ( { label, checked, help } ) => (
		<div data-checked={ String( checked ) }>
			{ label } { help }
		</div>
	),
} ) );

const SETTINGS_URL = 'https://app.godam.io/settings';
const NOTE = 'GoDAM adds the tracking code.';

const render = ( props ) =>
	renderToString(
		<VideoTrackingSection
			label="Marketo"
			settings={ { track_views: true } }
			onSettingChange={ jest.fn() }
			settingsUrl={ SETTINGS_URL }
			note={ NOTE }
			{ ...props }
		/>,
	);

describe( 'VideoTrackingSection', () => {
	it( 'hides the switch and points to Central when Central tracking is off', () => {
		const html = render( { centralTracking: false } );

		expect( html ).not.toContain( 'Track video views on this site' );
		expect( html ).not.toContain( NOTE );
		expect( html ).toContain( 'off on GoDAM Central' );
		expect( html ).toContain( `href="${ SETTINGS_URL }"` );
		expect( html ).toContain( 'Turn on in GoDAM Central' );
	} );

	it( 'leaves out the link when Central\'s URL is unknown', () => {
		const html = render( { centralTracking: false, settingsUrl: '' } );

		expect( html ).toContain( 'off on GoDAM Central' );
		expect( html ).not.toContain( 'Turn on in GoDAM Central' );
	} );

	it( 'shows Central\'s state, the switch and the note when Central tracking is on', () => {
		const html = render( { centralTracking: true } );

		expect( html ).toContain( 'GoDAM Central:' );
		expect( html ).toContain( 'Track video views on this site' );
		expect( html ).toContain( 'data-checked="true"' );
		expect( html ).toContain( NOTE );
	} );

	it( 'hides the note while the site switch is off', () => {
		const html = render( { centralTracking: true, settings: { track_views: false } } );

		expect( html ).toContain( 'data-checked="false"' );
		expect( html ).not.toContain( NOTE );
	} );

	it( 'keeps the switch, without Central\'s line, when Central\'s state is unknown', () => {
		const html = render( { centralTracking: undefined } );

		expect( html ).toContain( 'Track video views on this site' );
		expect( html ).not.toContain( 'GoDAM Central:' );
		expect( html ).not.toContain( 'off on GoDAM Central' );
	} );

	it( 'treats a site saved before the switch existed as on', () => {
		expect( render( { centralTracking: true, settings: {} } ) ).toContain( 'data-checked="true"' );
	} );
} );
