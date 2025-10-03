/**
 * GoDAM Player SDK
 * This is JavaScript SDK for interacting with the GoDAM Player embedded in an iframe.
 * It allows you to control playback, listen for events, and manage player state.
 *
 * @since 1.4.0
 */
class GodamPlayer {
	constructor( iframe, options = {} ) {
		if ( typeof iframe === 'string' ) {
			const element = document.querySelector( iframe );
			if ( ! element ) {
				throw new Error(
					`Could not find iframe element with selector "${ iframe }"`,
				);
			}
			this.iframe = element;
		} else {
			this.iframe = iframe;
		}

		if ( ! this.iframe || this.iframe.tagName !== 'IFRAME' ) {
			throw new Error( 'Element must be an iframe' );
		}

		this.options = {
			allowedOrigins: [ '*' ],
			enableDebugLogs: false,
			...options,
		};

		this.messageId = 0;
		this.pendingPromises = new Map();
		this.eventListeners = new Map();
		this.isPlayerReady = false;

		this.readyPromise = new Promise( ( resolve ) => {
			this.readyResolve = resolve;
		} );

		this.init();
	}

	init() {
		this.setupMessageListener();
		this.waitForIframeLoad();
	}

	waitForIframeLoad() {
		if ( this.iframe.contentWindow ) {
			this.log( 'Iframe already loaded' );
			return;
		}

		const onLoad = () => {
			this.log( 'Iframe loaded' );
			this.iframe.removeEventListener( 'load', onLoad );
		};

		this.iframe.addEventListener( 'load', onLoad );
	}

	setupMessageListener() {
		const handleMessage = ( event ) => {
			const { data, origin } = event;

			if ( ! this.isOriginAllowed( origin ) ) {
				this.log( `Blocked message from unauthorized origin: ${ origin }` );
				return;
			}

			if ( ! data || typeof data !== 'object' || ! data.type ) {
				return;
			}
			if ( ! data.type.startsWith( 'godam:' ) ) {
				return;
			}

			const messageType = data.type.replace( 'godam:', '' );
			const { payload, id } = data;

			this.log( 'Received message:', messageType, payload );

			if ( id && this.pendingPromises.has( id ) ) {
				const promise = this.pendingPromises.get( id );
				this.pendingPromises.delete( id );

				if ( messageType.endsWith( ':error' ) ) {
					promise.reject( new Error( payload?.message || 'Command failed' ) );
				} else {
					promise.resolve( payload );
				}
				return;
			}

			if ( messageType === 'ready' ) {
				this.isPlayerReady = true;
				this.readyResolve?.();
				this.emit( 'ready', payload );
			} else if ( messageType === 'event' ) {
				const eventData = payload;
				this.emit( eventData.event, eventData );
			}
		};

		window.addEventListener( 'message', handleMessage );
	}

	isOriginAllowed( origin ) {
		if ( this.options.allowedOrigins?.includes( '*' ) ) {
			return true;
		}

		return (
			this.options.allowedOrigins?.some( ( allowed ) => {
				if ( allowed.startsWith( '*.' ) ) {
					const domain = allowed.slice( 2 );
					return origin.endsWith( domain );
				}
				return origin === allowed;
			} ) || false
		);
	}

	log( ...args ) {
		if ( this.options.enableDebugLogs ) {
			console.log( '[GoDAM SDK]', ...args ); // eslint-disable-line no-console -- Required for debugging.
		}
	}

	generateMessageId() {
		return `godam_${ ++this.messageId }_${ Date.now() }`;
	}

	sendCommand( command, payload ) {
		return new Promise( ( resolve, reject ) => {
			if ( ! this.iframe.contentWindow ) {
				reject( new Error( 'Iframe not available' ) );
				return;
			}

			const messageId = this.generateMessageId();
			const timeoutId = setTimeout( () => {
				if ( this.pendingPromises.has( messageId ) ) {
					this.pendingPromises.delete( messageId );
					reject( new Error( `Command timeout: ${ command }` ) );
				}
			}, 5000 );

			this.pendingPromises.set( messageId, {
				resolve: ( result ) => {
					clearTimeout( timeoutId );
					resolve( result );
				},
				reject: ( error ) => {
					clearTimeout( timeoutId );
					reject( error );
				},
			} );

			try {
				this.iframe.contentWindow.postMessage(
					{
						type: `godam:${ command }`,
						payload,
						id: messageId,
					},
					'*',
				);

				this.log( 'Sent command:', command, payload );
			} catch ( error ) {
				this.pendingPromises.delete( messageId );
				clearTimeout( timeoutId );
				reject( error );
			}
		} );
	}

	on( event, callback ) {
		if ( ! this.eventListeners.has( event ) ) {
			this.eventListeners.set( event, [] );
		}
		this.eventListeners.get( event ).push( callback );
		return this;
	}

	off( event, callback ) {
		if ( ! this.eventListeners.has( event ) ) {
			return this;
		}

		if ( callback ) {
			const listeners = this.eventListeners.get( event );
			const index = listeners.indexOf( callback );
			if ( index > -1 ) {
				listeners.splice( index, 1 );
			}
		} else {
			this.eventListeners.set( event, [] );
		}
		return this;
	}

	emit( event, data ) {
		const listeners = this.eventListeners.get( event );
		if ( listeners ) {
			listeners.forEach( ( callback ) => {
				try {
					callback( data );
				} catch ( error ) {
					console.error( 'Error in %s event listener:', event, error ); // eslint-disable-line no-console -- Required for error logging.
				}
			} );
		}
	}

	ready() {
		return this.readyPromise;
	}

	play() {
		return this.sendCommand( 'play' );
	}

	pause() {
		return this.sendCommand( 'pause' );
	}

	seek( time ) {
		if ( typeof time !== 'number' ) {
			throw new Error( 'Time must be a number' );
		}
		return this.sendCommand( 'seek', { time } );
	}

	getCurrentTime() {
		return this.sendCommand( 'getCurrentTime' ).then(
			( result ) => result.time,
		);
	}

	getDuration() {
		return this.sendCommand( 'getDuration' ).then(
			( result ) => result.duration,
		);
	}

	setVolume( volume ) {
		if ( typeof volume !== 'number' || volume < 0 || volume > 1 ) {
			throw new Error( 'Volume must be a number between 0 and 1' );
		}
		return this.sendCommand( 'setVolume', { volume } );
	}

	getVolume() {
		return this.sendCommand( 'getVolume' ).then( ( result ) => result.volume );
	}

	setMuted( muted ) {
		return this.sendCommand( 'setMuted', { muted } );
	}

	getMuted() {
		return this.sendCommand( 'getMuted' ).then( ( result ) => result.muted );
	}

	isReady() {
		return this.isPlayerReady;
	}

	destroy() {
		this.pendingPromises.forEach( ( { reject } ) => {
			reject( new Error( 'Player destroyed' ) );
		} );
		this.pendingPromises.clear();
		this.eventListeners.clear();
		this.log( 'Player destroyed' );
	}
}

// Export the GodamPlayer class.
window.GoDAMPlayer = GodamPlayer;
