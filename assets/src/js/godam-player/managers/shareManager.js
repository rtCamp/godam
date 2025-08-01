/**
 * External dependencies
 */
import DOMPurify from 'isomorphic-dompurify';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import Share from '../../../../../assets/src/images/share.svg';
import ShareVariationOne from '../../../../../assets/src/images/share-variation-one.svg';
import CopyIcon from '../../../../../assets/src/images/clipboard.svg';
import Facebook from '../../../../../assets/src/images/facebook.svg';
import LinkedIn from '../../../../../assets/src/images/linkedin.svg';
import Reddit from '../../../../../assets/src/images/reddit.svg';
import Telegram from '../../../../../assets/src/images/telegram.svg';
import Twitter from '../../../../../assets/src/images/twitter-x.svg';
import Whatsapp from '../../../../../assets/src/images/whatsapp.svg';
import Complete from '../../../../../assets/src/images/check.svg';

import videojs from 'video.js';

// Keyboard event keys
const KEYBOARD_KEYS = {
	ENTER: 'Enter',
	SPACE: ' ',
	ESCAPE: 'Escape',
};

/**
 * ShareManager
 *
 * A utility class for managing share functionality in a Video.js player.
 * It adds a custom share button to the player interface and displays a modal
 * with shareable links and social media options.
 *
 * Core Features:
 *
 * 1. **Custom Share Button Integration**
 * - Registers a new Video.js button component (`GodamShareButton`).
 * - Dynamically selects icon based on player skin.
 * - Appends button to control bar or DOM based on layout and screen size.
 *
 * 2. **Share Modal with Social and Embed Options**
 * - Generates modal with page and embed links for the video.
 * - Provides copy-to-clipboard functionality with visual feedback.
 * - Includes social sharing links for platforms like Facebook, Twitter, LinkedIn, Reddit, WhatsApp, and Telegram.
 *
 * 3. **Accessibility and UX Enhancements**
 * - Keyboard interaction supported (Enter and Space on buttons).
 * - ESC key and outside-click handling for modal dismissal.
 * - Uses `DOMPurify` to sanitize injected HTML content safely.
 *
 * @class ShareManager
 * @param {Object}      player            - The Video.js player instance.
 * @param {HTMLElement} video             - The target video element.
 * @param {Object}      videoSetupOptions - Player setup configuration (e.g., skin style).
 *
 * @example
 * const shareManager = new ShareManager(playerInstance, videoElement, setupOptions);
 */
class ShareManager {
	constructor( player, video, videoSetupOptions ) {
		this.player = player;
		this.video = video;
		this.videoSetupOptions = videoSetupOptions;
		this.Button = videojs.getComponent( 'Button' );

		// Class constants
		this.MODAL_CONTAINER_CLASS = 'share-modal-container';
		this.MODAL_POPUP_CLASS = 'share-modal-popup';
		this.BODY_MODAL_OPEN_CLASS = 'godam-share-modal-open';
		this.CLOSING_CLASS_SUFFIX = '--closing';
		this.MODAL_CLOSE_DELAY = 300;
		this.COPY_FEEDBACK_DELAY = 2000;
		this.MIN_BUBBLE_WIDTH = 480;

		// Success styles for copy feedback
		this.COPY_SUCCESS_STYLES = {
			backgroundColor: '#4CAF50',
		};

		this.COPY_DEFAULT_STYLES = {
			backgroundColor: '#F7FAFB',
		};

		// Skins that use variation icon
		this.VARIATION_ICON_SKINS = [ 'Minimal', 'Pills', 'Bubble' ];

		this.init();
	}

	/**
	 * Initializes the ShareManager by registering the button and attaching it when ready.
	 */
	init() {
		this.registerShareButton();
		this.player.ready( () => this.addShareButton() );
	}

	/**
	 * Returns the appropriate share icon based on player skin.
	 *
	 * @return {string} Path to the icon image.
	 */
	getShareButtonIcon() {
		const skin = this.videoSetupOptions?.playerSkin;
		return this.VARIATION_ICON_SKINS.includes( skin ) ? ShareVariationOne : Share;
	}

	/**
	 * Creates social media sharing links configuration.
	 *
	 * @param {string} encodedLink - URL encoded video link.
	 * @param {string} message     - Encoded share message.
	 * @return {Array} Array of social link objects.
	 */
	createSocialLinksConfig( encodedLink, message ) {
		return [
			{
				className: 'facebook',
				href: `https://www.facebook.com/share.php?u=${ encodedLink }`,
				icon: Facebook,
			},
			{
				className: 'twitter',
				href: `https://twitter.com/intent/tweet?url=${ encodedLink }&text=${ message }`,
				icon: Twitter,
			},
			{
				className: 'linkedin',
				href: `https://www.linkedin.com/sharing/share-offsite/?url=${ encodedLink }&text=${ message }`,
				icon: LinkedIn,
			},
			{
				className: 'reddit',
				href: `http://www.reddit.com/submit?url=${ encodedLink }&title=${ message }`,
				icon: Reddit,
			},
			{
				className: 'whatsapp',
				href: `https://api.whatsapp.com/send?text=${ message }: ${ encodedLink }`,
				icon: Whatsapp,
			},
			{
				className: 'telegram',
				href: `https://telegram.me/share/url?url=${ encodedLink }&text=${ message }`,
				icon: Telegram,
			},
		];
	}

	/**
	 * Copies the input field content to clipboard and provides visual feedback.
	 *
	 * @param {string} inputId - The ID of the input element to copy from.
	 */
	copyToClipboard( inputId ) {
		const input = document.getElementById( inputId );
		if ( ! input ) {
			return;
		}

		const button = input.nextElementSibling;
		if ( ! button ) {
			return;
		}

		const icon = button.querySelector( 'img' );
		if ( ! icon ) {
			return;
		}

		this.applyCopyFeedback( button, icon );
	}

	/**
	 * Applies visual feedback for copy operation.
	 *
	 * @param {HTMLElement} button - The copy button element.
	 * @param {HTMLElement} icon   - The icon element within the button.
	 */
	applyCopyFeedback( button, icon ) {
		const input = button.previousElementSibling;

		const showSuccessState = () => {
			Object.assign( button.style, this.COPY_SUCCESS_STYLES );
			icon.src = Complete;
		};

		const resetToDefaultState = () => {
			Object.assign( button.style, this.COPY_DEFAULT_STYLES );
			icon.src = CopyIcon;
		};

		const provideFeedback = () => {
			showSuccessState();
			setTimeout( resetToDefaultState, this.COPY_FEEDBACK_DELAY );
		};

		if ( navigator.clipboard?.writeText ) {
			navigator.clipboard.writeText( input.value )
				.then( provideFeedback )
				.catch( () => {} );
		} else {
			this.fallbackCopyToClipboard( input, provideFeedback );
		}
	}

	/**
	 * Fallback method for copying to clipboard when modern API is not available.
	 *
	 * @param {HTMLElement} input    - The input element to copy from.
	 * @param {Function}    callback - Callback to execute on successful copy.
	 */
	fallbackCopyToClipboard( input, callback ) {
		input.select();
		input.setSelectionRange( 0, 99999 );
		try {
			document.execCommand( 'copy' );
			callback();
		} catch ( error ) {
			// Silent fail for old browsers
		}
	}

	/**
	 * Creates and injects the share modal into the DOM with social and embed options.
	 *
	 * @param {string} jobId - The ID of the video job to construct URLs.
	 */
	createShareModal( jobId ) {
		if ( document.querySelector( `.${ this.MODAL_CONTAINER_CLASS }` ) ) {
			return;
		}

		const urls = this.generateShareUrls( jobId );
		if ( ! urls ) {
			return;
		}

		const socialLinks = this.createSocialLinksConfig( urls.encodedLink, urls.message );
		const modalHtml = this.buildModalHtml( socialLinks, urls.videoLink, urls.embedCode );

		this.injectModalIntoDOM( modalHtml, socialLinks );
	}

	/**
	 * Generates the necessary URLs for sharing.
	 *
	 * @param {string} jobId - The video job ID.
	 * @return {Object|null} Object containing URLs or null if invalid.
	 */
	generateShareUrls( jobId ) {
		const baseUrl = window.godamData?.apiBase;
		if ( ! jobId || ! baseUrl ) {
			return null;
		}

		const videoLink = `${ baseUrl }/web/video/${ jobId }`;
		const embedCode = `<iframe src="${ baseUrl }/web/embed/${ jobId }"></iframe>`;
		const encodedLink = encodeURI( videoLink );
		const message = encodeURIComponent( __( 'Check out this video!', 'godam' ) );

		return { videoLink, embedCode, encodedLink, message };
	}

	/**
	 * Builds the HTML structure for the share modal.
	 *
	 * @param {Array}  socialLinks - Array of social media link configurations.
	 * @param {string} videoLink   - The direct video link.
	 * @param {string} embedCode   - The embed code for the video.
	 * @return {string} Complete HTML string for the modal.
	 */
	buildModalHtml( socialLinks, videoLink, embedCode ) {
		const socialLinksHtml = socialLinks.map( ( link ) =>
			`<a class="${ link.className } social-icon" target="_blank" rel="noopener noreferrer" tabindex="0">
				<img
					src="${ link.icon }"
					alt="${ `${ link.className } icon` }"
					height="20"
					width="20"
				/>
			</a>`,
		).join( '' );

		return `
			<div class="${ this.MODAL_POPUP_CLASS }">
				<div class="${ this.MODAL_POPUP_CLASS }__header">
					<span class="${ this.MODAL_POPUP_CLASS }__title">${ __( 'Share Media', 'godam' ) }</span>
					<div id="cancel-button" class="${ this.MODAL_POPUP_CLASS }__close-button" tabindex="0">&times;</div>
				</div>
				<div class="${ this.MODAL_POPUP_CLASS }__content">
					<div class="${ this.MODAL_POPUP_CLASS }__social-links">
						${ socialLinksHtml }
					</div>
				</div>
				<div class="${ this.MODAL_POPUP_CLASS }__footer">
					${ this.renderCopySection( 'page-link', videoLink, __( 'Page Link', 'godam' ) ) }
					${ this.renderCopySection( 'embed-code', embedCode, __( 'Embed', 'godam' ) ) }
				</div>
			</div>
		`;
	}

	/**
	 * Injects the modal HTML into the DOM and sets up event listeners.
	 *
	 * @param {string} modalHtml   - The HTML content for the modal.
	 * @param {Array}  socialLinks - Array of social media link configurations.
	 */
	injectModalIntoDOM( modalHtml, socialLinks ) {
		const container = document.createElement( 'div' );
		container.className = this.MODAL_CONTAINER_CLASS;
		container.innerHTML = DOMPurify.sanitize( modalHtml, { ADD_ATTR: [ 'target', 'rel' ] } );

		document.body.appendChild( container );
		document.body.classList.add( this.BODY_MODAL_OPEN_CLASS );

		this.setupModalEventListeners( container, socialLinks );
	}

	/**
	 * Sets up all event listeners for the modal.
	 *
	 * @param {HTMLElement} container   - The modal container element.
	 * @param {Array}       socialLinks - Array of social media link configurations.
	 */
	setupModalEventListeners( container, socialLinks ) {
		const cancelButton = container.querySelector( '#cancel-button' );
		const copyPageLink = container.querySelector( '#copy-page-link' );
		const copyEmbedCode = container.querySelector( '#copy-embed-code' );

		this.setupSocialLinkUrls( container, socialLinks );
		this.setupModalCloseHandlers( container, cancelButton );
		this.setupCopyButtonHandlers( copyPageLink, copyEmbedCode );
	}

	/**
	 * Sets up URLs for social media links.
	 *
	 * @param {HTMLElement} container   - The modal container.
	 * @param {Array}       socialLinks - Array of social link configurations.
	 */
	setupSocialLinkUrls( container, socialLinks ) {
		socialLinks.forEach( ( { className, href } ) => {
			const element = container.querySelector( `.${ className }` );
			if ( element ) {
				element.href = href;
			}
		} );
	}

	/**
	 * Sets up modal close event handlers.
	 *
	 * @param {HTMLElement} container    - The modal container.
	 * @param {HTMLElement} cancelButton - The close button element.
	 */
	setupModalCloseHandlers( container, cancelButton ) {
		const closeModal = () => {
			container.classList.add( `${ this.MODAL_CONTAINER_CLASS }${ this.CLOSING_CLASS_SUFFIX }` );
			container.querySelector( `.${ this.MODAL_POPUP_CLASS }` )
				.classList.add( `${ this.MODAL_POPUP_CLASS }${ this.CLOSING_CLASS_SUFFIX }` );

			setTimeout( () => {
				container.remove();
				document.body.classList.remove( this.BODY_MODAL_OPEN_CLASS );
			}, this.MODAL_CLOSE_DELAY );
		};

		const handleKeyboardClose = ( event ) => {
			if ( event.key === KEYBOARD_KEYS.ESCAPE ) {
				closeModal();
			}
		};

		// Click outside to close
		container.addEventListener( 'click', ( event ) => {
			if ( event.target === container ) {
				closeModal();
			}
		} );

		// ESC key to close
		document.addEventListener( 'keydown', handleKeyboardClose );

		// Close button handlers
		cancelButton.addEventListener( 'click', closeModal );
		cancelButton.addEventListener( 'keydown', ( event ) => {
			if ( [ KEYBOARD_KEYS.ENTER, KEYBOARD_KEYS.SPACE ].includes( event.key ) ) {
				event.preventDefault();
				closeModal();
			}
		} );
	}

	/**
	 * Sets up copy button event handlers.
	 *
	 * @param {HTMLElement} copyPageLink  - Page link copy button.
	 * @param {HTMLElement} copyEmbedCode - Embed code copy button.
	 */
	setupCopyButtonHandlers( copyPageLink, copyEmbedCode ) {
		const copyButtons = [
			{ button: copyPageLink, inputId: 'page-link' },
			{ button: copyEmbedCode, inputId: 'embed-code' },
		];

		copyButtons.forEach( ( { button, inputId } ) => {
			button.addEventListener( 'click', () => this.copyToClipboard( inputId ) );
			button.addEventListener( 'keydown', ( event ) => {
				if ( [ KEYBOARD_KEYS.ENTER, KEYBOARD_KEYS.SPACE ].includes( event.key ) ) {
					event.preventDefault();
					this.copyToClipboard( inputId );
				}
			} );
		} );
	}

	/**
	 * Returns HTML for a copyable input + button section.
	 *
	 * @param {string} id    - The input ID.
	 * @param {string} value - The input value.
	 * @param {string} label - The label above input.
	 * @return {string} HTML string for the copy section.
	 */
	renderCopySection( id, value, label ) {
		return `
			<div class='${ this.MODAL_POPUP_CLASS }__input-container'>
				<p class='share-modal-input-text'>${ label }</p>
				<div class="share-modal-input-group">
					<input id="${ id }" type="text" value='${ value }' readonly tabindex="0" />
					<span id="copy-${ id }" class="copy-button" tabindex="0">
						<img src="${ CopyIcon }" alt="${ __( 'copy icon', 'godam' ) }" height="24" width="24" />
					</span>
				</div>
			</div>`;
	}

	/**
	 * Registers the share button component with Video.js.
	 */
	registerShareButton() {
		const self = this;

		class GodamShareButton extends this.Button {
			buildCSSClass() {
				return `godam-share-button ${ super.buildCSSClass() }`;
			}

			createEl() {
				const element = super.createEl();
				const img = document.createElement( 'img' );
				img.src = self.getShareButtonIcon();
				img.alt = 'Share';
				img.className = 'share-icon';
				img.id = 'share-icon';
				element.appendChild( img );
				return element;
			}

			handleClick( event ) {
				event.preventDefault();
				self.createShareModal( self.player.jobId );
			}
		}

		if ( ! videojs.getComponent( 'GodamShareButton' ) ) {
			videojs.registerComponent( 'GodamShareButton', GodamShareButton );
		}
	}

	/**
	 * Appends the share button to the control bar or DOM based on skin and screen size.
	 */
	addShareButton() {
		const jobId = this.video.dataset.job_id;
		this.player.jobId = jobId;

		const container = this.player.el().closest( '.easydam-video-container' );
		if ( ! container || jobId === '' ) {
			return;
		}

		const ShareButton = videojs.getComponent( 'GodamShareButton' );
		const shareButtonInstance = new ShareButton( this.player );
		const buttonElement = shareButtonInstance.createEl();

		buttonElement.addEventListener( 'click', shareButtonInstance.handleClick.bind( shareButtonInstance ) );

		if ( this.shouldAddToControlBar( container ) ) {
			this.player.controlBar.addChild( 'GodamShareButton', {} );
		} else {
			container.appendChild( buttonElement );
		}
	}

	/**
	 * Determines whether the share button should be added to the control bar.
	 *
	 * @param {HTMLElement} container - The video container element.
	 * @return {boolean} True if button should be added to control bar.
	 */
	shouldAddToControlBar( container ) {
		return this.videoSetupOptions?.playerSkin === 'Bubble' &&
				container.offsetWidth > this.MIN_BUBBLE_WIDTH;
	}
}

export default ShareManager;
