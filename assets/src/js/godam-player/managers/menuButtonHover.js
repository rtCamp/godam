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
		// Add your hover listeners here
		btnEl.addEventListener( 'mouseenter', () => {
			menuEl.classList.add( 'vjs-lock-showing' );
		} );

		menuEl.addEventListener( 'mouseenter', () => {
			menuEl.classList.add( 'vjs-lock-showing' );
		} );

		menuEl.addEventListener( 'mouseout', ( e ) => {
			if ( ! btnEl.contains( e.relatedTarget ) ) {
				this.hideMenu( menuEl );
			}
		} );
	}

	hideMenu( menuEl ) {
		menuEl.style.display = '';
		menuEl.classList.remove( 'vjs-lock-showing' );
	}
}

export default MenuButtonHoverManager;
