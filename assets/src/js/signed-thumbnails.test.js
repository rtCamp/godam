/**
 * Internal dependencies
 */
import { useSignedCopy } from './signed-thumbnails';

const answer = {
	poster: 'https://cdn.test/private/p/thumb.jpg?token=a',
	image: 'https://cdn.test/private/p/photo.webp?token=d',
	sources: [ { src: 'https://cdn.test/private/p/index.m3u8?token=b', type: 'application/x-mpegURL' }, { src: 'https://cdn.test/private/p/v.mp4?token=c', type: 'video/mp4' } ],
};

describe( 'signed thumbnails', () => {
	beforeEach( () => {
		global.fetch = jest.fn( () => Promise.resolve( { ok: true, json: () => Promise.resolve( answer ) } ) );
		window.godamRestRoute = { url: 'http://site.test/wp-json/' };
	} );
	afterEach( () => {
		delete global.fetch;
	} );

	it( 'swaps a failed thumbnail for the signed poster, dropping its srcset', async () => {
		document.body.innerHTML = '<button data-godam-job="job-a"><img src="https://cdn.test/job-a/thumb.jpg" srcset="x 1x"></button>';
		const img = document.querySelector( 'img' );
		expect( await useSignedCopy( img ) ).toBe( true );
		expect( img.src ).toBe( answer.poster );
		expect( img.hasAttribute( 'srcset' ) ).toBe( false );
		expect( global.fetch ).toHaveBeenCalledWith( 'http://site.test/wp-json/godam/v1/playback/job-a', expect.anything() );
	} );

	it( 'swaps a failed preview video for the signed MP4', async () => {
		document.body.innerHTML = '<button data-godam-job="job-b"><video src="https://cdn.test/job-b/v.mp4"></video></button>';
		const video = document.querySelector( 'video' );
		expect( await useSignedCopy( video ) ).toBe( true );
		expect( video.src ).toBe( 'https://cdn.test/private/p/v.mp4?token=c' );
	} );

	it( 'tries once per element, and asks the route once per file', async () => {
		document.body.innerHTML = '<div data-godam-job="job-c"><img id="a"><img id="b"></div>';
		const [ a, b ] = document.querySelectorAll( 'img' );
		await useSignedCopy( a );
		await useSignedCopy( b );
		expect( await useSignedCopy( a ) ).toBe( false );
		expect( global.fetch ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'shows an image file in full, not its thumbnail', async () => {
		document.body.innerHTML = '<img data-godam-job="job-d" data-godam-kind="image" src="https://cdn.test/job-d/photo.webp">';
		const img = document.querySelector( 'img' );
		expect( await useSignedCopy( img ) ).toBe( true );
		expect( img.src ).toBe( answer.image );
	} );

	it( 'leaves an element alone when it has no GoDAM job', async () => {
		document.body.innerHTML = '<img src="https://site.test/a.jpg">';
		expect( await useSignedCopy( document.querySelector( 'img' ) ) ).toBe( false );
		expect( global.fetch ).not.toHaveBeenCalled();
	} );
} );
