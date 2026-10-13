/**
 * Unit tests for the copy-block attribute builders.
 *
 * `createImageAttributes` / `createBlockAttributes` shape the attributes the
 * editor's Copy action serializes into a Gutenberg block. They must match how
 * each block stores its own attributes (see the blocks' edit.js), so the pasted
 * block renders identically to the authored media.
 */

/**
 * Internal dependencies
 */
import { createImageAttributes, createBlockAttributes } from './index';

describe( 'createImageAttributes', () => {
	it( 'returns the base attributes (layers on) when media data is missing', () => {
		expect( createImageAttributes( 42, null ) ).toEqual( {
			id: 42,
			showImageLayers: true,
			className: 'wp-block-godam-image',
		} );
	} );

	it( 'coerces a string id to a number', () => {
		expect( createImageAttributes( '42', null ).id ).toBe( 42 );
	} );

	it( 'adds url, alt and dimensions from media_details', () => {
		const attrs = createImageAttributes( 7, {
			source_url: 'https://cdn.example/img.png',
			alt_text: 'A cat',
			media_details: { width: 1280, height: 720 },
		} );

		expect( attrs ).toEqual( {
			id: 7,
			showImageLayers: true,
			className: 'wp-block-godam-image',
			url: 'https://cdn.example/img.png',
			alt: 'A cat',
			width: 1280,
			height: 720,
		} );
	} );

	it( 'falls back to meta dimensions when media_details is absent', () => {
		const attrs = createImageAttributes( 7, {
			source_url: 'https://cdn.example/img.png',
			meta: { width: '640', height: '480' },
		} );

		expect( attrs.width ).toBe( 640 );
		expect( attrs.height ).toBe( 480 );
	} );

	it( 'omits dimensions unless both width and height are present', () => {
		const attrs = createImageAttributes( 7, {
			source_url: 'https://cdn.example/img.png',
			media_details: { width: 1280 },
		} );

		expect( attrs ).not.toHaveProperty( 'width' );
		expect( attrs ).not.toHaveProperty( 'height' );
	} );

	it( 'strips HTML from alt text', () => {
		const attrs = createImageAttributes( 7, {
			source_url: 'https://cdn.example/img.png',
			alt_text: '<b>Bold</b>   alt',
		} );

		expect( attrs.alt ).toBe( 'Bold alt' );
	} );

	it( 'omits url and alt when they are empty', () => {
		const attrs = createImageAttributes( 7, { source_url: '', alt_text: '' } );

		expect( attrs ).not.toHaveProperty( 'url' );
		expect( attrs ).not.toHaveProperty( 'alt' );
	} );
} );

describe( 'createBlockAttributes dispatch', () => {
	const mediaData = {
		source_url: 'https://cdn.example/media',
		media_details: { width: 100, height: 50 },
	};

	it( 'routes image to createImageAttributes', () => {
		const attrs = createBlockAttributes( 1, mediaData, 'image' );
		expect( attrs.className ).toBe( 'wp-block-godam-image' );
		expect( attrs.showImageLayers ).toBe( true );
		expect( attrs.url ).toBe( 'https://cdn.example/media' );
	} );

	it( 'routes audio to createAudioAttributes', () => {
		const attrs = createBlockAttributes( 1, mediaData, 'audio' );
		expect( attrs.className ).toBe( 'wp-block-godam-audio' );
		expect( attrs.src ).toBe( 'https://cdn.example/media' );
		// Image-only attributes must not leak into the audio block.
		expect( attrs ).not.toHaveProperty( 'showImageLayers' );
	} );

	it( 'routes video (and unknown types) to createVideoAttributes', () => {
		const video = createBlockAttributes( 1, mediaData, 'video' );
		expect( video.aspectRatio ).toBe( 'responsive' );
		expect( video.src ).toBe( 'https://cdn.example/media' );
		expect( video.videoWidth ).toBe( '100' );

		// Anything that is not audio/image falls through to video.
		expect( createBlockAttributes( 1, mediaData, undefined ) ).toEqual( video );
	} );
} );
