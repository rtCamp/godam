/**
 * CaptionHoverManager
 *
 * Keeps the captions (CC) menu open when hovering over the captions button
 * or the captions submenu, instead of requiring an explicit click.
 */
class MenuButtonHoverManager {
	constructor( player ) {
		if ( player.godamMenuButtonHoverManager?.destroy ) {
			player.godamMenuButtonHoverManager.destroy();
		}

		this.player = player;
		this.cleanups = [];
		this.isDestroyed = false;

		// Add more menu button component names as needed
		this.menuButtons = [ 'SubsCapsButton', 'SettingsButton', 'CaptionsButton', 'SubtitlesButton' ];

		this.player.godamMenuButtonHoverManager = this;

		if ( typeof this.player.one === 'function' ) {
			this.player.one( 'dispose', () => this.destroy() );
		}

		this.init();
	}

	init() {
		this.menuButtons.forEach( ( buttonName ) => {
			const button = this.player.controlBar?.getChild( buttonName );
			let btnEl = button?.el();

			// Fallback to DOM search if component not found via getChild (common in Safari/iOS)
			if ( ! btnEl ) {
				const classMap = {
					SubsCapsButton: '.vjs-subs-caps-button',
					SettingsButton: '.vjs-settings-button',
					CaptionsButton: '.vjs-captions-button',
					SubtitlesButton: '.vjs-subtitles-button',
				};

				const className = classMap[ buttonName ] || null;

				if ( className ) {
					btnEl = this.player.el().querySelector( className );
				}
			}

			if ( ! btnEl ) {
				return;
			}

			// Avoid duplicate listeners when manager is initialized multiple times.
			if ( btnEl.dataset.menuHoverBound === 'true' ) {
				return;
			}
			btnEl.dataset.menuHoverBound = 'true';

			// initialize clicked state per button
			btnEl.dataset.clickedOpen = 'false';
			this.attachMenuListeners( btnEl );
		} );
	}

	attachMenuListeners( btnEl ) {
		let overBtn = false;
		let overMenu = false;
		const getMenuEl = () => btnEl.querySelector( '.vjs-menu' );
		let currentMenuEl = null;
		const abortController = new AbortController();
		let menuObserver = null;

		// ensure dataset exists
		if ( typeof btnEl.dataset.clickedOpen === 'undefined' ) {
			btnEl.dataset.clickedOpen = 'false';
		}

		const isClickedOpen = () => btnEl.dataset.clickedOpen === 'true';

		const update = () => {
			const menuEl = getMenuEl();
			// only hide if not hovered and not clicked-open for this button
			if ( menuEl && ! overBtn && ! overMenu && ! isClickedOpen() ) {
				this.hideMenu( menuEl );
			}
		};

		const ensureMenuHoverListeners = () => {
			const menuEl = getMenuEl();
			if ( ! menuEl || menuEl === currentMenuEl ) {
				return;
			}
			currentMenuEl = menuEl;

			menuEl.addEventListener( 'mouseenter', () => {
				overMenu = true;
				if ( ! isClickedOpen() ) {
					menuEl.style.display = 'block';
					menuEl.classList.add( 'vjs-lock-showing' );
					// Keep button in hover state while interacting with menu
					btnEl.classList.add( 'vjs-hover' );
					this.closeOtherMenus( menuEl );
				}
			}, { signal: abortController.signal } );

			menuEl.addEventListener( 'mouseleave', () => {
				overMenu = false;
				btnEl.classList.remove( 'vjs-hover' );
				setTimeout( update, 500 );
			}, { signal: abortController.signal } );
		};

		// Click toggles state for THIS button only
		btnEl.addEventListener( 'click', () => {
			const menuEl = getMenuEl();
			if ( ! menuEl ) {
				return;
			}

			// toggle our per-button clicked state
			const currently = isClickedOpen();
			if ( ! currently ) {
				// open this one, mark it clicked-open
				btnEl.dataset.clickedOpen = 'true';
				menuEl.style.display = 'block';
				menuEl.classList.add( 'vjs-lock-showing' );
				// close other menus AND clear their clicked flags
				this.closeOtherMenus( menuEl );
			} else {
				// user clicked to close
				btnEl.dataset.clickedOpen = 'false';
				this.hideMenu( menuEl );
			}
		}, { signal: abortController.signal } );

		// Hover logic: only affects non-click-opened menus
		btnEl.addEventListener( 'mouseenter', () => {
			const menuEl = getMenuEl();
			overBtn = true;
			if ( menuEl && ! isClickedOpen() ) {
				menuEl.style.display = 'block';
				menuEl.classList.add( 'vjs-lock-showing' );
				// Add vjs-hover class to button to maintain active state in Safari
				btnEl.classList.add( 'vjs-hover' );
				this.closeOtherMenus( menuEl );
			}
		}, { signal: abortController.signal } );

		btnEl.addEventListener( 'mouseleave', () => {
			overBtn = false;
			btnEl.classList.remove( 'vjs-hover' );
			setTimeout( update, 500 ); // small delay to allow moving between
		}, { signal: abortController.signal } );

		// Detect outside clicks to reset clickedOpen for the specific button
		document.addEventListener( 'click', ( e ) => {
			const menuEl = getMenuEl();
			if ( ! menuEl ) {
				return;
			}

			// If clicked outside of this button/menu, clear its clicked flag and hide
			if ( ! btnEl.contains( e.target ) && ! menuEl.contains( e.target ) ) {
				btnEl.dataset.clickedOpen = 'false';
				this.hideMenu( menuEl );
			}
		}, { signal: abortController.signal } );

		// Bind menu hover listeners now and whenever Video.js swaps menu DOM.
		ensureMenuHoverListeners();
		menuObserver = new MutationObserver( () => {
			ensureMenuHoverListeners();
		} );
		menuObserver.observe( btnEl, { childList: true, subtree: true } );

		this.cleanups.push( () => {
			abortController.abort();
			menuObserver?.disconnect();
			menuObserver = null;
			delete btnEl.dataset.menuHoverBound;
			delete btnEl.dataset.clickedOpen;
		} );
	}

	destroy() {
		if ( this.isDestroyed ) {
			return;
		}
		this.isDestroyed = true;

		this.cleanups.forEach( ( cleanup ) => cleanup() );
		this.cleanups = [];

		if ( this.player?.godamMenuButtonHoverManager === this ) {
			delete this.player.godamMenuButtonHoverManager;
		}
	}

	hideMenu( menuEl ) {
		// If menu removed or null, nothing to do
		if ( ! menuEl ) {
			return;
		}

		// also clear the clicked state of its parent button (if present)
		const parentBtn = menuEl.parentElement;
		if ( parentBtn && parentBtn.dataset ) {
			parentBtn.dataset.clickedOpen = 'false';
		}

		// Start fade-out
		menuEl.classList.add( 'vjs-closing' );
		menuEl.classList.remove( 'vjs-lock-showing' );

		// Wait for transition to finish, then reset display
		setTimeout( () => {
			if ( menuEl.classList.contains( 'vjs-closing' ) ) {
				menuEl.classList.remove( 'vjs-closing' );
				// Now it will animate from 0.5 → 0 (if your CSS has that)
				const onTransitionEnd = () => {
					if ( ! menuEl.classList.contains( 'vjs-lock-showing' ) ) {
						menuEl.style.display = '';
					}
					menuEl.removeEventListener( 'transitionend', onTransitionEnd );
				};
				menuEl.addEventListener( 'transitionend', onTransitionEnd );
			}
		}, 300 );
	}

	// Hide other menus when entering a new one — also clear their clickedOpen
	closeOtherMenus( currentMenu ) {
		document.querySelectorAll( '.vjs-menu' ).forEach( ( menu ) => {
			if ( menu !== currentMenu ) {
				// clear clickedOpen flag on the parent button if present
				const parentBtn = menu.parentElement;
				if ( parentBtn && parentBtn.dataset ) {
					parentBtn.dataset.clickedOpen = 'false';
				}

				menu.classList.remove( 'vjs-lock-showing' );
				menu.style.display = '';
			}
		} );
	}
}

export default MenuButtonHoverManager;
