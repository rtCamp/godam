/**
 * CaptionHoverManager
 *
 * Keeps the captions (CC) menu open when hovering over the captions button
 * or the captions submenu, instead of requiring an explicit click.
 */
class MenuButtonHoverManager {
	constructor( player ) {
		this.player = player;

		// Add more menu button component names as needed
		this.menuButtons = [ 'SubsCapsButton', 'SettingsButton' ];

		this.init();
	}

	init() {
		this.menuButtons.forEach( ( buttonName ) => {
			const button = this.player.controlBar?.getChild( buttonName );

			if ( ! button ) {
				return;
			}

			const btnEl = button.el();
			if ( ! btnEl ) {
				return;
			}

			// initialize clicked state per button
			btnEl.dataset.clickedOpen = 'false';

			const menuEl = btnEl.querySelector( '.vjs-menu' );
			if ( menuEl ) {
				this.attachMenuListeners( btnEl, menuEl );
			} else {
				const observer = new MutationObserver( () => {
					const observedMenuEl = btnEl.querySelector( '.vjs-menu' );
					if ( observedMenuEl ) {
						this.attachMenuListeners( btnEl, observedMenuEl );
						observer.disconnect();
					}
				} );
				observer.observe( btnEl, { childList: true, subtree: true } );
			}
		} );
	}

	attachMenuListeners( btnEl, menuEl ) {
		let overBtn = false;
		let overMenu = false;

		// ensure dataset exists
		if ( typeof btnEl.dataset.clickedOpen === 'undefined' ) {
			btnEl.dataset.clickedOpen = 'false';
		}

		const isClickedOpen = () => btnEl.dataset.clickedOpen === 'true';

		const update = () => {
			// only hide if not hovered and not clicked-open for this button
			if ( ! overBtn && ! overMenu && ! isClickedOpen() ) {
				this.hideMenu( menuEl );
			}
		};

		// Click toggles state for THIS button only
		btnEl.addEventListener( 'click', () => {
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
		} );

		// Hover logic: only affects non-click-opened menus
		btnEl.addEventListener( 'mouseenter', () => {
			overBtn = true;
			if ( ! isClickedOpen() ) {
				menuEl.style.display = 'block';
				menuEl.classList.add( 'vjs-lock-showing' );
				this.closeOtherMenus( menuEl );
			}
		} );

		btnEl.addEventListener( 'mouseleave', () => {
			overBtn = false;
			setTimeout( update, 500 ); // small delay to allow moving between
		} );

		menuEl.addEventListener( 'mouseenter', () => {
			overMenu = true;
			if ( ! isClickedOpen() ) {
				menuEl.style.display = 'block';
				menuEl.classList.add( 'vjs-lock-showing' );
				this.closeOtherMenus( menuEl );
			}
		} );

		menuEl.addEventListener( 'mouseleave', () => {
			overMenu = false;
			setTimeout( update, 500 );
		} );

		// Detect outside clicks to reset clickedOpen for the specific button
		document.addEventListener( 'click', ( e ) => {
			// If clicked outside of this button/menu, clear its clicked flag and hide
			if ( ! btnEl.contains( e.target ) && ! menuEl.contains( e.target ) ) {
				btnEl.dataset.clickedOpen = 'false';
				this.hideMenu( menuEl );
			}
		} );
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
