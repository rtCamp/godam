/**
 * The poll routes need the `upload_files` capability, so the Media Editor's
 * requests must carry the REST nonce. Without it WordPress treats the cookie
 * request as logged out and the Poll layer's picker comes back empty.
 */

/**
 * External dependencies
 */
import { configureStore } from '@reduxjs/toolkit';

/**
 * jsdom has no Fetch API classes. These cover what RTK Query's
 * fetchBaseQuery uses for a GET with a JSON response.
 */
class StubHeaders {
	constructor( init = {} ) {
		this.map = new Map();
		const entries = init instanceof StubHeaders ? init.map : Object.entries( init );
		for ( const [ key, value ] of entries ) {
			this.set( key, value );
		}
	}
	set( key, value ) {
		this.map.set( key.toLowerCase(), String( value ) );
	}
	get( key ) {
		return this.map.get( key.toLowerCase() ) ?? null;
	}
	has( key ) {
		return this.map.has( key.toLowerCase() );
	}
	delete( key ) {
		this.map.delete( key.toLowerCase() );
	}
	forEach( callback ) {
		this.map.forEach( ( value, key ) => callback( value, key, this ) );
	}
}

class StubRequest {
	constructor( url, config = {} ) {
		Object.assign( this, config );
		this.url = url;
		this.headers = new StubHeaders( config.headers );
	}
	clone() {
		return new StubRequest( this.url, this );
	}
}

class StubResponse {
	constructor( body, status = 200 ) {
		this.body = body;
		this.status = status;
		this.ok = status >= 200 && status < 300;
		this.headers = new StubHeaders( { 'content-type': 'application/json' } );
	}
	clone() {
		return new StubResponse( this.body, this.status );
	}
	async text() {
		return this.body;
	}
	async json() {
		return JSON.parse( this.body );
	}
}

describe( 'pollsAPI', () => {
	let pollsAPI;
	let store;
	let requests;

	beforeEach( () => {
		requests = [];
		global.Headers = StubHeaders;
		global.Request = StubRequest;
		global.Response = StubResponse;
		global.fetch = jest.fn( async ( request ) => {
			requests.push( request );
			return new StubResponse( '[]' );
		} );
		window.godamRestRoute = { url: 'https://example.test/wp-json/', nonce: 'abc123' };
		window.pathJoin = ( parts ) => parts.join( '' ).replace( /([^:])\/{2,}/g, '$1/' );

		// polls.js reads the REST root when it loads, so load it after the globals.
		jest.isolateModules( () => {
			( { pollsAPI } = require( './polls' ) );
		} );
		store = configureStore( {
			reducer: { [ pollsAPI.reducerPath ]: pollsAPI.reducer },
			middleware: ( getDefault ) => getDefault().concat( pollsAPI.middleware ),
		} );
	} );

	afterEach( () => {
		delete window.godamRestRoute;
		delete window.pathJoin;
	} );

	it.each( [
		[ 'getPolls', undefined, 'https://example.test/wp-json/godam/v1/polls' ],
		[ 'getPoll', 7, 'https://example.test/wp-json/godam/v1/poll/7' ],
	] )( '%s sends the REST nonce', async ( endpoint, arg, url ) => {
		await store.dispatch( pollsAPI.endpoints[ endpoint ].initiate( arg ) );

		expect( requests ).toHaveLength( 1 );
		expect( requests[ 0 ].url ).toBe( url );
		expect( requests[ 0 ].headers.get( 'X-WP-Nonce' ) ).toBe( 'abc123' );
	} );
} );
