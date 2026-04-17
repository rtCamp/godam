/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { stripHtmlTags } from '../../blocks/godam-player/utils/index.js';

( function( $ ) {
	'use strict';

	let isVirtualAttachmentListenerBound = false;
	let isSeoPrefillListenerBound = false;

	const ATTACHMENT_CACHE_MAX_ENTRIES = 100;

	/**
	 * Simple size-limited cache that evicts the oldest entry when the maximum
	 * size is reached, preventing unbounded memory growth in long editing sessions.
	 */
	class LRUCache extends Map {
		constructor( maxSize ) {
			super();
			this.maxSize = maxSize;
		}
		set( key, value ) {
			if ( this.maxSize && this.size >= this.maxSize && ! this.has( key ) ) {
				const firstKey = this.keys().next().value;
				if ( undefined !== firstKey ) {
					this.delete( firstKey );
				}
			}
			return super.set( key, value );
		}
	}

	const attachmentDataCache = new LRUCache( ATTACHMENT_CACHE_MAX_ENTRIES );

	// Initialize video selector on document ready and when WPBakery reloads the params
	$( document ).ready( initVideoSelector );
	$( document ).on( 'vc.reload', initVideoSelector );

	function initVideoSelector() {
		bindVirtualAttachmentReplacement();
		bindSeoPrefillHandlers();

		// Initialize previews for already selected videos on page load
		initializeExistingPreviews();

		$( '.video-selector-button' ).off( 'click' ).on( 'click', function( e ) {
			e.preventDefault();

			const $button = $( this );
			const paramName = $button.data( 'param' );
			const $container = $button.closest( '.video_selector_block' );
			const $input = $container.find( '.video_selector_field' );

			// Create WordPress media frame
			const frame = wp.media( {
				title: 'Select or Upload Video',
				button: {
					text: 'Select Video',
				},
				library: {
					type: 'video',
				},
				multiple: false,
			} );

			// When a video is selected
			frame.on( 'select', function() {
				const attachment = frame.state().get( 'selection' ).first().toJSON();

				// Update the hidden input value
				$input.val( attachment.id ).trigger( 'change' );

				// Update button text
				$button.text( __( 'Replace', 'godam' ) );

				// Add or update preview
				let $preview = $container.find( '.video-selector-preview' );
				if ( $preview.length === 0 ) {
					$preview = $( '<div class="video-selector-preview" style="margin-top: 10px;"></div>' );
					$container.append( $preview );
				}

				$preview.html(
					'<video width="100%" height="auto" controls style="max-width: 300px;">' +
					'<source src="' + attachment.url + '" type="' + attachment.mime + '">' +
					'</video>',
				);

				maybePrefillSeoFields( $container );

				// Add or update remove button in the buttons wrapper
				const $buttonsWrapper = $container.find( '.video_selector-buttons-wrapper' );
				let $removeButton = $buttonsWrapper.find( '.video-selector-remove' );
				if ( $removeButton.length === 0 ) {
					$removeButton = $( '<button class="button video-selector-remove" data-param="' + paramName + '" style="margin-left: 5px;">Remove</button>' );
					$buttonsWrapper.append( $removeButton );
				}

				// Re-attach remove handler
				initRemoveHandler();
			} );

			// Open the media frame
			frame.open();
		} );

		// Initialize remove handler
		initRemoveHandler();
	}

	/**
	 * Initialize previews for already selected videos on page load
	 */
	function initializeExistingPreviews() {
		$( '.video_selector_block' ).each( function() {
			const $container = $( this );
			const $input = $container.find( '.video_selector_field' );
			const $button = $container.find( '.video-selector-button' );
			const attachmentId = $input.val();

			if ( attachmentId ) {
				// Update button text to show video can be replaced
				$button.text( __( 'Replace', 'godam' ) );

				// Fetch attachment data and create preview
				fetchAttachmentData( attachmentId ).then( function( attachment ) {
					if ( ! attachment || ! attachment.url ) {
						return;
					}

					let $preview = $container.find( '.video-selector-preview' );
					if ( $preview.length === 0 ) {
						$preview = $( '<div class="video-selector-preview" style="margin-top: 10px;"></div>' );
						$container.append( $preview );
					}

					const mimeType = attachment.mime || attachment.post_mime_type || 'video/mp4';
					$preview.html(
						'<video width="100%" height="auto" controls style="max-width: 300px;">' +
						'<source src="' + attachment.url + '" type="' + mimeType + '">' +
						'</video>',
					);

					// Add remove button if not exists
					const $buttonsWrapper = $container.find( '.video_selector-buttons-wrapper' );
					let $removeButton = $buttonsWrapper.find( '.video-selector-remove' );
					if ( $removeButton.length === 0 ) {
						$removeButton = $( '<button class="button video-selector-remove" style="margin-left: 5px;">Remove</button>' );
						$buttonsWrapper.append( $removeButton );
						initRemoveHandler();
					}
				} ).catch( function() {
					// Silently fail for existing previews
				} );
			}
		} );
	}

	function bindSeoPrefillHandlers() {
		if ( isSeoPrefillListenerBound ) {
			return;
		}

		$( document ).on( 'change', '.wpb_vc_param_value[name="seo_override"]', function() {
			const $scope = getSeoScope( $( this ) );
			const $overrideField = getParamField( $scope, 'seo_override' );

			if ( ! $overrideField.length || '1' !== String( $overrideField.val() ) ) {
				return;
			}

			const $headlineField = getParamField( $scope, 'seo_headline' );
			const $descriptionField = getParamField( $scope, 'seo_description' );
			const hasExistingSeo = !! ( $headlineField.val() || $descriptionField.val() );

			prefillSeoFieldsFromAttachment( $scope, ! hasExistingSeo );
		} );

		$( document ).on( 'change', '.video_selector_field[name="id"]', function() {
			const $scope = getSeoScope( $( this ) );
			prefillSeoFieldsFromAttachment( $scope, false );
		} );

		isSeoPrefillListenerBound = true;
	}

	function getSeoScope( $element ) {
		const $scope = $element.closest( '.vc_ui-panel-window' );
		return $scope.length ? $scope : $( document );
	}

	function getParamField( $scope, paramName ) {
		return $scope.find( `.wpb_vc_param_value[name="${ paramName }"]` ).first();
	}

	function maybePrefillSeoFields( $container ) {
		const $scope = getSeoScope( $container );
		prefillSeoFieldsFromAttachment( $scope, false );
	}

	function prefillSeoFieldsFromAttachment( $scope, forcePopulate ) {
		const $overrideField = getParamField( $scope, 'seo_override' );
		const $videoIdField = getParamField( $scope, 'id' );
		const seoOverrideEnabled = '1' === String( $overrideField.val() );
		const attachmentId = parseInt( $videoIdField.val(), 10 );

		if ( ! seoOverrideEnabled || ! attachmentId ) {
			return;
		}

		fetchAttachmentData( attachmentId ).then( ( attachmentData ) => {
			if ( ! attachmentData ) {
				return;
			}

			const seoData = getSeoDataFromAttachment( attachmentData );
			const $headlineField = getParamField( $scope, 'seo_headline' );
			const $descriptionField = getParamField( $scope, 'seo_description' );
			const $familyFriendlyField = getParamField( $scope, 'seo_family_friendly' );

			const shouldSetHeadline = forcePopulate || ! String( $headlineField.val() || '' ).trim();
			const shouldSetDescription = forcePopulate || ! String( $descriptionField.val() || '' ).trim();
			const shouldSetFamilyFriendly = forcePopulate || ! String( $familyFriendlyField.val() || '' ).trim();

			if ( shouldSetHeadline ) {
				$headlineField.val( seoData.headline ).trigger( 'change' );
			}

			if ( shouldSetDescription ) {
				$descriptionField.val( seoData.description ).trigger( 'change' );
			}

			if ( shouldSetFamilyFriendly ) {
				$familyFriendlyField.val( seoData.familyFriendly ).trigger( 'change' );
			}
		} ).catch( () => {
			// Silently fail to avoid interrupting editor interactions.
		} );
	}

	function fetchAttachmentData( attachmentId ) {
		if ( attachmentDataCache.has( attachmentId ) ) {
			return attachmentDataCache.get( attachmentId );
		}

		const requestPromise = ( wp?.apiFetch
			? wp.apiFetch( { path: `/wp/v2/media/${ attachmentId }` } )
			: wp.media.attachment( attachmentId ).fetch()
		).then( ( response ) => response?.toJSON ? response.toJSON() : response )
			.catch( ( error ) => {
				// Remove failed requests from cache so subsequent calls can retry.
				attachmentDataCache.delete( attachmentId );
				throw error;
			} );

		attachmentDataCache.set( attachmentId, requestPromise );
		return requestPromise;
	}

	function getFirstNonEmpty( ...values ) {
		const validValue = values.find( ( value ) => {
			if ( null === value || undefined === value ) {
				return false;
			}

			if ( 'string' === typeof value || 'number' === typeof value ) {
				return String( value ).trim().length > 0;
			}

			return false;
		} );

		return undefined === validValue ? '' : String( validValue );
	}

	function getSeoDataFromAttachment( attachmentData ) {
		return {
			headline: getFirstNonEmpty( attachmentData?.title?.rendered, attachmentData?.title, attachmentData?.slug ),
			description: stripHtmlTags( getFirstNonEmpty( attachmentData?.description?.rendered, attachmentData?.description ) ),
			familyFriendly: '1',
		};
	}

	/**
	 * Replace temporary virtual media IDs with actual attachment IDs
	 * once media entry creation is completed.
	 */
	function bindVirtualAttachmentReplacement() {
		if ( isVirtualAttachmentListenerBound ) {
			return;
		}

		document.addEventListener( 'godam-virtual-attachment-created', function( event ) {
			const { attachment, virtualMediaId } = event?.detail || {};

			if ( ! attachment?.id || ! virtualMediaId ) {
				return;
			}

			$( '.video_selector_field' ).each( function() {
				const $input = $( this );
				const currentValue = $input.val();

				if ( String( currentValue ) !== String( virtualMediaId ) ) {
					return;
				}

				const $container = $input.closest( '.video_selector_block' );
				const $selectButton = $container.find( '.video-selector-button' );
				const $buttonsWrapper = $container.find( '.video_selector-buttons-wrapper' );
				const mimeType = attachment.mime || attachment.post_mime_type || 'video/mp4';

				$input.val( attachment.id ).trigger( 'change' );
				$selectButton.text( __( 'Replace', 'godam' ) );

				let $preview = $container.find( '.video-selector-preview' );
				if ( $preview.length === 0 ) {
					$preview = $( '<div class="video-selector-preview" style="margin-top: 10px;"></div>' );
					$container.append( $preview );
				}

				if ( attachment.url ) {
					$preview.html(
						'<video width="100%" height="auto" controls style="max-width: 300px;">' +
						'<source src="' + attachment.url + '" type="' + mimeType + '">' +
						'</video>',
					);
				}

				maybePrefillSeoFields( $container );

				let $removeButton = $buttonsWrapper.find( '.video-selector-remove' );
				if ( $removeButton.length === 0 ) {
					$removeButton = $( `<button class="button video-selector-remove" style="margin-left: 5px;">${ __( 'Remove', 'godam' ) }</button>` );
					$buttonsWrapper.append( $removeButton );
					initRemoveHandler();
				}
			} );
		} );

		isVirtualAttachmentListenerBound = true;
	}

	function initRemoveHandler() {
		$( '.video-selector-remove' ).off( 'click' ).on( 'click', function( e ) {
			e.preventDefault();

			const $button = $( this );
			const $container = $button.closest( '.video_selector_block' );
			const $input = $container.find( '.video_selector_field' );
			const $selectButton = $container.find( '.video-selector-button' );

			// Clear the input value
			$input.val( '' ).trigger( 'change' );

			// Remove preview
			$container.find( '.video-selector-preview' ).remove();

			// Remove the remove button itself
			$button.remove();

			// Update button text
			$selectButton.text( 'Select video' );
		} );
	}
}( window.jQuery ) );
