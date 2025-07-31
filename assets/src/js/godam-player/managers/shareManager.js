/**
 * ShareManager is responsible for integrating a customizable share button into the Video.js player,
 * creating a modal UI with copyable links and social media sharing options.
 *
 * @module ShareManager
 */

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

/**
 * Class to manage share functionality in a Video.js player.
 */
class ShareManager {
	/**
	 * @param {Object}      player            - The Video.js player instance.
	 * @param {HTMLElement} video             - The video DOM element.
	 * @param {Object}      videoSetupOptions - Configuration options like skin.
	 */
	constructor( player, video, videoSetupOptions ) {
		this.player = player;
		this.video = video;
		this.videoSetupOptions = videoSetupOptions;
		this.Button = videojs.getComponent( 'Button' );

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
	shareButtonImg() {
		const skin = this.videoSetupOptions?.playerSkin;
		return [ 'Minimal', 'Pills', 'Bubble' ].includes( skin )
			? ShareVariationOne
			: Share;
	}

	/**
	 * Copies the input field content to clipboard and gives feedback.
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

		const setSuccessStyle = () => {
			button.style.backgroundColor = '#4CAF50';
			icon.src = Complete;
		};

		const resetStyle = () => {
			button.style.backgroundColor = '#F7FAFB';
			icon.src = CopyIcon;
		};

		const doFeedback = () => {
			setSuccessStyle();
			setTimeout( resetStyle, 2000 );
		};

		if ( navigator.clipboard?.writeText ) {
			navigator.clipboard.writeText( input.value ).then( doFeedback ).catch( () => {} );
		} else {
			input.select();
			input.setSelectionRange( 0, 99999 );
			try {
				document.execCommand( 'copy' );
				doFeedback();
			} catch ( _ ) {}
		}
	}

	/**
	 * Creates and injects the share modal into the DOM with social and embed options.
	 *
	 * @param {string} jobId - The ID of the video job to construct URLs.
	 */
	createShareModal( jobId ) {
		if ( document.querySelector( '.share-modal-container' ) ) {
			return;
		}

		const baseUrl = window.godamData?.apiBase;
		if ( ! jobId || ! baseUrl ) {
			return;
		}

		const videoLink = `${ baseUrl }/web/video/${ jobId }`;
		const embedCode = `<iframe src="${ baseUrl }/web/embed/${ jobId }"></iframe>`;
		const encodedLink = encodeURI( videoLink );
		const message = encodeURIComponent( __( 'Check out this video!', 'godam' ) );

		const socialLinks = [
			{ className: 'facebook', href: `https://www.facebook.com/share.php?u=${ encodedLink }`, icon: Facebook },
			{ className: 'twitter', href: `https://twitter.com/intent/tweet?url=${ encodedLink }&text=${ message }`, icon: Twitter },
			{ className: 'linkedin', href: `https://www.linkedin.com/sharing/share-offsite/?url=${ encodedLink }&text=${ message }`, icon: LinkedIn },
			{ className: 'reddit', href: `http://www.reddit.com/submit?url=${ encodedLink }&title=${ message }`, icon: Reddit },
			{ className: 'whatsapp', href: `https://api.whatsapp.com/send?text=${ message }: ${ encodedLink }`, icon: Whatsapp },
			{ className: 'telegram', href: `https://telegram.me/share/url?url=${ encodedLink }&text=${ message }`, icon: Telegram },
		];

		const html = `
			<div class="share-modal-popup">
				<div class="share-modal-popup__header">
					<span class="share-modal-popup__title">${ __( 'Share Media', 'godam' ) }</span>
					<div id="cancel-button" class="share-modal-popup__close-button" tabindex="0">&times;</div>
				</div>
				<div class="share-modal-popup__content">
					<div class="share-modal-popup__social-links">
						${ socialLinks.map( ( link ) =>
		`<a class="${ link.className } social-icon" target="_blank" rel="noopener noreferrer" tabindex="0">
								<img
									src="${ link.icon }"
									alt="${ `${ link.className } icon` }"
									height="20"
									width="20"
								/>
							</a>` ).join( '' ) }
					</div>
				</div>
				<div class="share-modal-popup__footer">
					${ this.renderCopySection( 'page-link', videoLink, __( 'Page Link', 'godam' ) ) }
					${ this.renderCopySection( 'embed-code', embedCode, __( 'Embed', 'godam' ) ) }
				</div>
			</div>
		`;

		const container = document.createElement( 'div' );
		container.className = 'share-modal-container';
		container.innerHTML = DOMPurify.sanitize( html, { ADD_ATTR: [ 'target', 'rel' ] } );
		document.body.appendChild( container );
		document.body.classList.add( 'godam-share-modal-open' );

		const cancelButton = container.querySelector( '#cancel-button' );
		const copyPageLink = container.querySelector( '#copy-page-link' );
		const copyEmbedCode = container.querySelector( '#copy-embed-code' );

		socialLinks.forEach( ( { className, href } ) => {
			const el = container.querySelector( `.${ className }` );
			if ( el ) {
				el.href = href;
			}
		} );

		const closeModal = () => {
			container.classList.add( 'share-modal-container--closing' );
			container.querySelector( '.share-modal-popup' ).classList.add( 'share-modal-popup--closing' );
			setTimeout( () => {
				container.remove();
				document.body.classList.remove( 'godam-share-modal-open' );
			}, 300 );
		};

		const handleEscape = ( e ) => e.key === 'Escape' && closeModal();

		container.addEventListener( 'click', ( e ) => e.target === container && closeModal() );
		document.addEventListener( 'keydown', handleEscape );

		[ copyPageLink, copyEmbedCode ].forEach( ( btn, i ) => {
			const id = i === 0 ? 'page-link' : 'embed-code';
			btn.addEventListener( 'click', () => this.copyToClipboard( id ) );
			btn.addEventListener( 'keydown', ( e ) => {
				if ( [ 'Enter', ' ' ].includes( e.key ) ) {
					e.preventDefault();
					this.copyToClipboard( id );
				}
			} );
		} );

		cancelButton.addEventListener( 'click', closeModal );
		cancelButton.addEventListener( 'keydown', ( e ) => {
			if ( [ 'Enter', ' ' ].includes( e.key ) ) {
				e.preventDefault();
				closeModal();
			}
		} );
	}

	/**
	 * Returns HTML for a copyable input + button section.
	 *
	 * @param {string} id    - The input ID.
	 * @param {string} value - The input value.
	 * @param {string} label - The label above input.
	 * @return {string} Sanitized HTML string.
	 */
	renderCopySection( id, value, label ) {
		return `
			<div class='share-modal-popup__input-container'>
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
				const el = super.createEl();
				const img = document.createElement( 'img' );
				img.src = self.shareButtonImg();
				img.alt = 'Share';
				img.className = 'share-icon';
				img.id = 'share-icon';
				el.appendChild( img );
				return el;
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
	 * Appends the share button to the control bar or DOM based on skin/responsiveness.
	 */
	addShareButton() {
		const jobId = this.video.dataset.job_id;
		this.player.jobId = jobId;

		const container = this.player.el().closest( '.easydam-video-container' );
		if ( ! container || jobId === '' ) {
			return;
		}

		const ShareButton = videojs.getComponent( 'GodamShareButton' );
		const shareBtnInstance = new ShareButton( this.player );
		const btnEl = shareBtnInstance.createEl();

		btnEl.addEventListener( 'click', shareBtnInstance.handleClick.bind( shareBtnInstance ) );

		if ( this.videoSetupOptions?.playerSkin === 'Bubble' && container.offsetWidth > 480 ) {
			this.player.controlBar.addChild( 'GodamShareButton', {} );
		} else {
			container.appendChild( btnEl );
		}
	}
}

export default ShareManager;
