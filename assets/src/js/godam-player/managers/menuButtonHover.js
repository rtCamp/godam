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

		const update = () => {
			if ( ! overBtn && ! overMenu ) {
				this.hideMenu( menuEl );
			}
		};

		btnEl.addEventListener( 'mouseenter', () => {
			overBtn = true;
			menuEl.style.display = 'block';
			menuEl.classList.add( 'vjs-lock-showing' );
			this.closeOtherMenus( menuEl );
		} );

		btnEl.addEventListener( 'mouseleave', () => {
			overBtn = false;
			setTimeout( update, 500 ); // small delay to allow moving between
		} );

		menuEl.addEventListener( 'mouseenter', () => {
			overMenu = true;
			menuEl.style.display = 'block';
			menuEl.classList.add( 'vjs-lock-showing' );
			this.closeOtherMenus( menuEl );
		} );

		menuEl.addEventListener( 'mouseleave', () => {
			overMenu = false;
			setTimeout( update, 500 );
		} );
	}

	hideMenu( menuEl ) {
		// Start fade-out
		menuEl.classList.add( 'vjs-closing' );
		menuEl.classList.remove( 'vjs-lock-showing' );

		// Wait for transition to finish, then reset display
		setTimeout( () => {
			if ( menuEl.classList.contains( 'vjs-closing' ) ) {
				menuEl.classList.remove( 'vjs-closing' );
				// Now it will animate from 0.5 → 0
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

	// Hide other menus when entering a new one
	closeOtherMenus( currentMenu ) {
		document.querySelectorAll( '.vjs-menu' ).forEach( ( menu ) => {
			if ( menu !== currentMenu ) {
				menu.classList.remove( 'vjs-lock-showing' );
				menu.style.display = '';
			}
		} );
	}
}

export default MenuButtonHoverManager;
