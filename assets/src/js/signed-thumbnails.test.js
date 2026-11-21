/**
 * Internal dependencies
 */
import { init, playbackFor, useSignedCopy } from './signed-thumbnails';

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

describe( 'signed thumbnails, refusals and the page watcher', () => {
	afterEach( () => {
		delete global.fetch;
		delete window.godamRestRoute;
	} );
	const reply = ( body, ok = true ) => {
		global.fetch = jest.fn( () => Promise.resolve( { ok, json: () => Promise.resolve( body ) } ) );
	};

	it( 'leaves the element alone when the route refuses or fails', async () => {
		reply( {}, false );
		document.body.innerHTML = '<img data-godam-job="job-refused" src="https://cdn.test/x.jpg">';
		expect( await useSignedCopy( document.querySelector( 'img' ) ) ).toBe( false );

		global.fetch = jest.fn( () => Promise.reject( new Error( 'offline' ) ) );
		document.body.innerHTML = '<img data-godam-job="job-offline" src="https://cdn.test/y.jpg">';
		expect( await useSignedCopy( document.querySelector( 'img' ) ) ).toBe( false );
	} );

	it( 'leaves an image without a signed poster, and a video without a signed MP4', async () => {
		reply( { sources: [ { src: 'https://cdn.test/private/p/index.m3u8', type: 'application/x-mpegURL' } ] } );
		document.body.innerHTML = '<div data-godam-job="job-nomp4"><img src="https://cdn.test/a.jpg"><video src="https://cdn.test/a.mp4"></video></div>';
		expect( await useSignedCopy( document.querySelector( 'img' ) ) ).toBe( false );
		expect( await useSignedCopy( document.querySelector( 'video' ) ) ).toBe( false );
	} );

	it( 'asks the site\'s default REST base when the page has no route setting', async () => {
		reply( { poster: 'https://cdn.test/private/p/t.jpg' } );
		await playbackFor( 'job-default-base' );
		expect( global.fetch ).toHaveBeenCalledWith( '/wp-json/godam/v1/playback/job-default-base', expect.anything() );
	} );

	it( 'swaps a thumbnail when it fails after load, catching the error in the capture phase', async () => {
		reply( { poster: 'https://cdn.test/private/p/late.jpg' } );
		document.body.innerHTML = '<a data-godam-job="job-late"><img src="https://cdn.test/late.jpg"></a><img id="other" src="https://site.test/other.jpg">';
		init( document );
		const img = document.querySelector( 'img' );
		img.dispatchEvent( new Event( 'error' ) );
		document.getElementById( 'other' ).dispatchEvent( new Event( 'error' ) );
		await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );
		expect( img.src ).toBe( 'https://cdn.test/private/p/late.jpg' );
		expect( global.fetch ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'watches the page document by default, and ignores errors from anything but images and videos', async () => {
		reply( { poster: 'https://cdn.test/private/p/default-doc.jpg' } );
		document.body.innerHTML = '<div data-godam-job="job-doc"><img src="https://cdn.test/d.jpg"><span>x</span></div>';
		init();
		document.querySelector( 'span' ).dispatchEvent( new Event( 'error' ) );
		document.querySelector( 'img' ).dispatchEvent( new Event( 'error' ) );
		await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );
		expect( document.querySelector( 'img' ).src ).toBe( 'https://cdn.test/private/p/default-doc.jpg' );
		expect( global.fetch ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'swaps what already failed before the script ran, and leaves what loaded', async () => {
		reply( { poster: 'https://cdn.test/private/p/early.jpg', sources: [ { src: 'https://cdn.test/private/p/v.mp4', type: 'video/mp4' } ] } );
		document.body.innerHTML = '<div data-godam-job="job-early"><img id="broken" src="https://cdn.test/b.jpg"><img id="fine" src="https://cdn.test/f.jpg"><video src="https://cdn.test/v.mp4"></video></div>';
		const broken = document.getElementById( 'broken' );
		const fine = document.getElementById( 'fine' );
		const video = document.querySelector( 'video' );
		for ( const [ el, width ] of [ [ broken, 0 ], [ fine, 640 ] ] ) {
			Object.defineProperty( el, 'complete', { value: true } );
			Object.defineProperty( el, 'currentSrc', { value: el.src } );
			Object.defineProperty( el, 'naturalWidth', { value: width } );
		}
		Object.defineProperty( video, 'error', { value: { code: 4 } } );
		init( document );
		await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );
		expect( broken.src ).toBe( 'https://cdn.test/private/p/early.jpg' );
		expect( fine.src ).toBe( 'https://cdn.test/f.jpg' );
		expect( video.src ).toBe( 'https://cdn.test/private/p/v.mp4' );
	} );
} );
