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
	let isParamGroupObserverSetup = false;

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
		setupParamGroupObserver();

		// Direct-bind to ALL current video-selector buttons in the DOM. This
		// covers both top-level params (GoDAM Video element) and any param_group
		// items that are already rendered when vc.reload fires. Direct binding
		// fires before WPBakery's panel click guards can stop propagation.
		// The namespace `.godam-vs` prevents duplicate handlers across reloads.
		$( '.video-selector-button' )
			.off( 'click.godam-vs' )
			.on( 'click.godam-vs', openVideoSelectorFrame );

		$( '.video-selector-remove' )
			.off( 'click.godam-vs' )
			.on( 'click.godam-vs', removeVideoSelector );
	}

	/**
	 * Open the WP media frame for a video-selector button.
	 * Shared by both the direct-bind path (top-level params) and
	 * the delegated path (param_group rows).
	 *
	 * @param {jQuery.Event} e
	 */
	function openVideoSelectorFrame( e ) {
		e.preventDefault();

		const $button = $( this );
		const paramName = $button.data( 'param' );
		const $container = $button.closest( '.video_selector_block' );
		const $input = $container.find( '.video_selector_field' );

		const frame = wp.media( {
			title: __( 'Select or Upload Video', 'godam' ),
			button: { text: __( 'Select Video', 'godam' ) },
			library: { type: 'video' },
			multiple: false,
		} );

		frame.on( 'select', function() {
			const attachment = frame.state().get( 'selection' ).first().toJSON();

			$input.val( attachment.id ).trigger( 'change' );
			$button.text( __( 'Replace', 'godam' ) );

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

			const $buttonsWrapper = $container.find( '.video_selector-buttons-wrapper' );
			if ( 0 === $buttonsWrapper.find( '.video-selector-remove' ).length ) {
				$buttonsWrapper.append(
					'<button type="button" class="button video-selector-remove" data-param="' + paramName + '" style="margin-left: 5px;">' +
					__( 'Remove', 'godam' ) +
					'</button>',
				);
			}
		} );

		frame.open();
	}

	/**
	 * Remove the selected video from a video-selector field.
	 *
	 * @param {jQuery.Event} e
	 */
	function removeVideoSelector( e ) {
		e.preventDefault();

		const $button = $( this );
		const $container = $button.closest( '.video_selector_block' );
		const $input = $container.find( '.video_selector_field' );
		const $selectButton = $container.find( '.video-selector-button' );

		$input.val( '' ).trigger( 'change' );
		$container.find( '.video-selector-preview' ).remove();
		$button.remove();
		$selectButton.text( __( 'Select video', 'godam' ) );

	/**
	 * Watch for video-selector buttons added dynamically by WPBakery's
	 * param_group (e.g. when the user clicks "Add Item"). Delegation on
	 * `document` is unreliable because WPBakery's panel click guards stop
	 * propagation before events reach document. A MutationObserver lets us
	 * direct-bind to each new button the moment it enters the DOM, so the
	 * handler fires at the element level before any stopPropagation can
	 * intercept it. Only set up once per page load.
	 */
	function setupParamGroupObserver() {
		if ( isParamGroupObserverSetup ) {
			return;
		}

		const observer = new MutationObserver( function( mutations ) {
			for ( const mutation of mutations ) {
				for ( const node of mutation.addedNodes ) {
					if ( node.nodeType !== Node.ELEMENT_NODE ) {
						continue;
					}

					// Collect any video-selector-button elements inside the
					// added subtree (and the node itself if it matches).
					const $buttons = $( node )
						.find( '.video-selector-button' )
						.add( $( node ).filter( '.video-selector-button' ) );

					$buttons
						.off( 'click.godam-vs' )
						.on( 'click.godam-vs', openVideoSelectorFrame );

					const $removes = $( node )
						.find( '.video-selector-remove' )
						.add( $( node ).filter( '.video-selector-remove' ) );

					$removes
						.off( 'click.godam-vs' )
						.on( 'click.godam-vs', removeVideoSelector );
				}
			}
		} );

		observer.observe( document.body, { childList: true, subtree: true } );

		isParamGroupObserverSetup = true;
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
					$removeButton = $( `<button type="button" class="button video-selector-remove" style="margin-left: 5px;">${ __( 'Remove', 'godam' ) }</button>` );
					$buttonsWrapper.append( $removeButton );
				}
			} );
		} );

		isVirtualAttachmentListenerBound = true;
	}
}( window.jQuery ) );
