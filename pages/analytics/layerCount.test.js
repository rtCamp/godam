/**
 * Unit tests for `getLayerCount` — the "N layers" badge count on the video
 * analytics hero, read from a `/wp/v2/media/{id}` response.
 *
 * @package
 */

/**
 * Internal dependencies
 */
import { getLayerCount } from './layerCount';

// Trimmed `/wp/v2/media/{id}` response: registered post meta sits under `meta`,
// while `rtgodam_meta` is its own top-level REST field.
const mediaResponse = ( rtgodamMeta ) => ( {
	id: 42,
	title: { rendered: 'Product demo' },
	mime_type: 'video/mp4',
	meta: {
		rtgodam_media_video_thumbnail: 'https://example.com/thumb.jpg',
	},
	rtgodam_meta: rtgodamMeta,
} );

describe( 'getLayerCount', () => {
	it( 'counts the layers in the top-level rtgodam_meta field', () => {
		const response = mediaResponse( {
			videoConfig: {},
			layers: [
				{ id: 'L1', type: 'cta', displayTime: 2 },
				{ id: 'L2', type: 'form', displayTime: 8 },
				{ id: 'L3', type: 'hotspot', displayTime: 15 },
			],
			chapters: [],
		} );

		expect( getLayerCount( response ) ).toBe( 3 );
	} );

	it( 'ignores layers nested under meta, where the REST API never puts them', () => {
		const response = {
			...mediaResponse( { layers: [] } ),
			meta: { rtgodam_meta: { layers: [ { id: 'L1' } ] } },
		};

		expect( getLayerCount( response ) ).toBe( 0 );
	} );

	it( 'returns 0 when the field is null for users who cannot edit the video', () => {
		expect( getLayerCount( mediaResponse( null ) ) ).toBe( 0 );
	} );

	it( 'returns 0 when there are no saved layers or no response yet', () => {
		expect( getLayerCount( mediaResponse( { videoConfig: {} } ) ) ).toBe( 0 );
		expect( getLayerCount( mediaResponse( '' ) ) ).toBe( 0 );
		expect( getLayerCount( null ) ).toBe( 0 );
	} );
} );
