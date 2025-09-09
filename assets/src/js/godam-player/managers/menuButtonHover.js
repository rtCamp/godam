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

			// Observe for insertion of .vjs-menu
			const observer = new MutationObserver( () => {
				const menuEl = btnEl.querySelector( '.vjs-menu' );
				if ( menuEl ) {
					this.attachMenuListeners( btnEl, menuEl );
					observer.disconnect(); // stop after found
				}
			} );

			observer.observe( btnEl, { childList: true, subtree: true } );
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
			menuEl.classList.add( 'vjs-lock-showing' );
			this.closeOtherMenus( menuEl );
		} );
		btnEl.addEventListener( 'mouseleave', () => {
			overBtn = false;
			setTimeout( update, 500 ); // small delay to allow moving between
		} );

		menuEl.addEventListener( 'mouseenter', () => {
			overMenu = true;
			menuEl.classList.add( 'vjs-lock-showing' );
			this.closeOtherMenus( menuEl );
		} );
		menuEl.addEventListener( 'mouseleave', () => {
			overMenu = false;
			setTimeout( update, 500 );
		} );
	}

	hideMenu( menuEl ) {
		menuEl.style.display = '';
		menuEl.classList.remove( 'vjs-lock-showing' );
	}

	// Hide other menus when entering a new one
	closeOtherMenus( currentMenu ) {
		document.querySelectorAll( '.vjs-menu' )
			.forEach( ( menu ) => {
				if ( menu !== currentMenu ) {
					menu.classList.remove( 'vjs-lock-showing' );
					menu.style.display = '';
				}
			} );
	}
}

export default MenuButtonHoverManager;
