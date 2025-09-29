/**
 * External dependencies
 */
import videojs from 'video.js';

// Only import qualityLevels if not already registered
if ( ! videojs.getPlugin( 'qualityLevels' ) ) {
	import( 'videojs-contrib-quality-levels' );
}

import DOMPurify from 'isomorphic-dompurify';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

const BackIcon = () => {
	return `
		<svg class="godam-chevron-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" width="12" height="12">
			<path fill="currentColor" d="M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l192 192c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 246.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-192 192z"/>
		</svg>
	`;
};

const ForwardIcon = () => {
	return `
		<svg class="godam-chevron-icon master-settings-back-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" width="12" height="12">
			<path fill="currentColor" d="M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z"/>
		</svg>
	`;
};

const checkIcon = () => {
	return `
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="12" height="12" class="godam-check-icon">
			<path fill="currentColor" d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/>
		</svg>
		`;
};

class SettingsButton extends videojs.getComponent( 'MenuButton' ) {
	constructor( player, options ) {
		super( player, options );
		this.player_ = player;
		this.player_.selectedSpeed ??= '1x';
		this.player_.selectedQuality ??= 'Auto';
		this.addClass( 'vjs-settings-button' );
		this.controlText( 'Settings' );
		this.hasQualityItem = false;

		this.setupDynamicMenuItems();
	}

	setupDynamicMenuItems() {
		// add dynamic menu items setup requiring async data.
		const qualityLevels = this.player_.qualityLevels();

		qualityLevels.on( 'addqualitylevel', () => {
			if ( ! this.hasQualityItem ) {
				this.menu.addChild(
					new QualityMenuItem( this.player_, { label: 'Quality' } ),
				);
				this.hasQualityItem = true;
			}
		} );
	}

	createItems() {
		// Create the items for the settings button with no dynamic data.
		return [
			new SpeedMenuItem( this.player_, { label: 'Speed' } ),
			// Add future settings here.
		];
	}

	// Override handleClick to reset to default menu when settings button is clicked
	handleClick( event ) {
		// If we're in a submenu (originalItems_ exists), reset to default menu
		if ( this.originalItems_ ) {
			this.resetToDefaultMenu();
		}

		// Call parent handleClick to handle normal menu toggle behavior
		super.handleClick( event );
	}

	// Method for the outside click listener
	outsideClickListener() {
		if ( this.el() ) {
			this.menu.unlockShowing();
			this.resetToDefaultMenu();
		}
	}

	// Method to add an event listener to close the settings menu when clicked outside
	attachOutsideClickListener() {
		if ( ! this.el() ) {
			return;
		}

		// Attach a new outside click listener and store its reference
		this._outsideClickListener = this.outsideClickListener.bind( this );
		document.addEventListener( 'click', this._outsideClickListener, { once: true } );
	}

	// Method to detach the outside click listener
	detachOutsideClickListener() {
		if ( this._outsideClickListener ) {
			document.removeEventListener( 'click', this._outsideClickListener );
			this._outsideClickListener = null;
		}
	}

	// Method to reset menu to default state
	resetToDefaultMenu() {
		if ( this.originalItems_ ) {
			// Clear current submenu items
			const currentItems = this.menu.children().slice();
			currentItems.forEach( ( item ) => {
				this.menu.removeChild( item );
			} );

			// Restore original items
			this.originalItems_.forEach( ( item ) => {
				this.menu.addChild( item );
			} );

			const playerEl = this.player_.el();
			playerEl.classList.remove( 'godam-submenu-open' );

			// Reset original items reference
			this.originalItems_ = null;
		}
	}

	// Override the superclass dispose method
	dispose() {
		this.detachOutsideClickListener(); // Detach the outside click listener
		super.dispose();
	}
}

// Utility function to close menu and reset to default menu
function closeAndResetMenu( menuButton ) {
	menuButton.menu.hide();
	menuButton.menu.unlockShowing();
	menuButton.resetToDefaultMenu(); // reset to default menu
}

function openSubmenu( menuButton, items, title = '' ) {
	// Ensure the menu is created
	if ( ! menuButton.menu ) {
		menuButton.createMenu();
	}

	// Store original items for back navigation
	if ( ! menuButton.originalItems_ ) {
		menuButton.originalItems_ = menuButton.menu.children().slice();
	}

	menuButton.player_.el().classList.add( 'godam-submenu-open' );

	// Clear existing menu items using Video.js methods
	const mainMenuItems = menuButton.menu.children().slice();

	// Create back button as a proper Video.js component
	class BackMenuItem extends videojs.getComponent( 'MenuItem' ) {
		constructor( player, options ) {
			super( player, options );
			this.addClass( 'vjs-back-item' );
		}

		createEl() {
			const el = super.createEl();
			// el.innerHTML = '<span class="vjs-menu-item-text">← Back</span>';
			const html = `
            <div class="godam-menu-item-container godam-back-item-container">
                ${ BackIcon() }
				<span>${ title }</span>
            </div>
        `;

			el.innerHTML = DOMPurify.sanitize( html );
			return el;
		}

		handleClick() {
			// Use the resetToDefaultMenu method from the settings button
			menuButton.resetToDefaultMenu();
		}
	}

	// Add back button
	const backItem = new BackMenuItem( menuButton.player_, { label: title } );
	menuButton.menu.addChild( backItem );

	// Create submenu items as proper Video.js components
	items.forEach( ( itemData ) => {
		class SubmenuItem extends videojs.getComponent( 'MenuItem' ) {
			constructor( player, options ) {
				super( player, options );
				this.itemData_ = itemData;
			}

			createEl() {
				const el = super.createEl();

				let isSelected = false;
				if ( title === 'Speed' ) {
					const currentSpeed = this.player().selectedSpeed || '1x';
					isSelected = currentSpeed === itemData.label;
				} else if ( title === 'Quality' ) {
					const currentQuality = this.player().selectedQuality || 'Auto';
					isSelected = currentQuality === itemData.label;
				}

				let html = '';

				// Handle different item data formats
				if ( typeof itemData === 'string' ) {
					html = `<span class="vjs-menu-item-text">${ itemData }</span>`;
				} else if ( typeof itemData === 'object' && itemData.html ) {
					html = `
					<div class="selected-menu-item">
						${ isSelected ? checkIcon() : '' }
						<span class="vjs-menu-item-text">${ itemData.html }</span>
					</div>`;
				} else {
					html = `<span class="vjs-menu-item-text">${ __( 'Invalid item', 'godam' ) }</span>`;
				}

				el.innerHTML = DOMPurify.sanitize( html );

				return el;
			}

			handleClick( event ) {
				event.stopPropagation();
				event.preventDefault();
				const label = this.itemData_.label || this.itemData_;

				// Handle quality selection
				if ( title === 'Quality' ) {
					this.handleQualitySelection( label );
				} else if ( title === 'Speed' ) {
					this.handleSpeedSelection( label );
				}

				// Close menu after selection
				// menuButton.menu.hide();
				menuButton.el_.focus();
			}

			handleQualitySelection( qualityLabel ) {
				const qualityLevels = this.player_.qualityLevels();

				if ( qualityLabel === 'Auto' ) {
					// Enable all levels for automatic selection
					for ( let i = 0; i < qualityLevels.length; i++ ) {
						qualityLevels[ i ].enabled = true;
					}
					this.player().selectedQuality = 'Auto';
				} else {
					// Parse height from label like '720p'
					const selectedHeight = parseInt( qualityLabel.replace( 'p', '' ), 10 );

					for ( let i = 0; i < qualityLevels.length; i++ ) {
						const level = qualityLevels[ i ];
						level.enabled = level.height === selectedHeight;
					}
					this.player().selectedQuality = selectedHeight + 'p';
				}

				closeAndResetMenu( menuButton );
			}

			handleSpeedSelection( speed ) {
				// Implement playback speed change
				const rate = parseFloat( speed.replace( 'x', '' ) );
				this.player().playbackRate( rate );
				this.player().selectedSpeed = speed;

				closeAndResetMenu( menuButton );
			}
		}

		const submenuItem = new SubmenuItem( menuButton.player_, {
			label: itemData.label || itemData,
		} );
		menuButton.menu.addChild( submenuItem );
	} );

	mainMenuItems.forEach( ( item ) => {
		menuButton.menu.removeChild( item );
	} );// Remove existing menu items

	// Force menu to update
	menuButton.menu.show();

	// Ensure the outside click listener is attached
	if ( menuButton && typeof menuButton.attachOutsideClickListener === 'function' ) {
		menuButton.attachOutsideClickListener();
	}
}

class QualityMenuItem extends videojs.getComponent( 'MenuItem' ) {
	createEl() {
		const el = super.createEl();
		const html = `
            <div class="godam-menu-item-container">
                <div class="vjs-menu-item-text">
                    <span class="vjs-icon-hd"></span>
                    <span>Quality</span>
                </div>
                ${ ForwardIcon() }
            </div>
        `;

		el.innerHTML = DOMPurify.sanitize( html );

		return el;
	}

	handleClick() {
		const qualityLevels = this.player().qualityLevels();

		const items = [];

		for ( let i = 0; i < qualityLevels.length; i++ ) {
			const level = qualityLevels[ i ];
			items.push( {
				html: `${ level.height }p`,
				label: `${ level.height }p`,
			} );
		}

		// Get parent settings button
		const settingsButton = this.player()
			.getChild( 'controlBar' )
			.getChild( 'SettingsButton' );

		// Add Auto at top
		items.unshift( { html: 'Auto', label: 'Auto' } );

		openSubmenu( settingsButton, items, 'Quality' );
	}
}

class SpeedMenuItem extends videojs.getComponent( 'MenuItem' ) {
	createEl() {
		const el = super.createEl();

		const html = `
          <div class="godam-menu-item-container">
                <div class="vjs-menu-item-text">
                    <span class="vjs-icon-play-circle">
                    </span>
                    <span>Speed</span>
                </div>
                 ${ ForwardIcon() }
            </div>
        `;

		el.innerHTML = DOMPurify.sanitize( html );

		return el;
	}

	handleClick() {
		// Get the parent settings button
		const settingsButton = this.player()
			.getChild( 'controlBar' )
			.getChild( 'SettingsButton' );

		openSubmenu(
			settingsButton,
			[
				{ html: '0.5x', label: '0.5x' },
				{ html: '1x', label: '1x' },
				{ html: '1.5x', label: '1.5x' },
				{ html: '2x', label: '2x' },
			],
			'Speed',
		);

		// Fix: re-focus and ensure menu behaves consistently
		setTimeout( () => {
			settingsButton.el_.focus();
			settingsButton.menuButtonPressed_ = true; // maintain pressed state
			settingsButton.menu.lockShowing(); // keep menu visible
		}, 0 );
	}
}

// Register the component so it can be found by the control bar
videojs.registerComponent( 'SettingsButton', SettingsButton );

export default SettingsButton;
