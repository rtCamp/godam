/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { stripHtmlTags, isFilenameLikeTitle, appendTimezoneOffsetToUTC } from '../../blocks/godam-player/utils/index.js';

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

	/**
	 * SEO fields that always come from the selected video and can't be edited,
	 * as in the Gutenberg "Video SEO Schema" modal and the Elementor popover.
	 */
	const SEO_READONLY_FIELDS = [ 'seo_content_url', 'seo_upload_date', 'seo_duration', 'seo_thumbnail_url' ];

	/**
	 * SEO fields that show the Media Library values and become editable only
	 * when "Override SEO" is Yes.
	 */
	const SEO_OVERRIDABLE_FIELDS = [ 'seo_headline', 'seo_description', 'seo_family_friendly' ];

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
	 * @param {Event} e - jQuery click event.
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
				$preview = $( '<div class="video-selector-preview" data-test-id="godam-wpb-preview-video" style="margin-top: 10px;"></div>' );
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
					'<button type="button" class="button video-selector-remove" data-test-id="godam-wpb-button-remove-video" data-param="' + paramName + '" style="margin-left: 5px;">' +
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
	 * @param {Event} e - jQuery click event.
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
	}

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

					// An element's edit panel was rendered: check the title and fill
					// the SEO fields. Deferred so WPBakery finishes setting up the
					// params (dependencies, select2) first.
					$( node )
						.find( '.wpb_vc_param_value[name="seo_override"]' )
						.add( $( node ).filter( '.wpb_vc_param_value[name="seo_override"]' ) )
						.each( function() {
							const $scope = getSeoScope( $( this ) );
							setTimeout( () => {
								updateFilenameTitleWarning( $scope );
								syncSeoPanel( $scope );
							}, 0 );
						} );
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
			updateFilenameTitleWarning( $scope );
		} );

		$( document ).on( 'change', '.wpb_vc_param_value[name="seo_override"]', function() {
			const $scope = getSeoScope( $( this ) );
			updateFilenameTitleWarning( $scope );
			syncSeoPanel( $scope );
		} );

		$( document ).on( 'change', '.video_selector_field[name="id"]', function() {
			syncSeoPanel( getSeoScope( $( this ) ) );
		} );

		$( document ).on( 'click', '.godam-wpb-seo-reset', function( event ) {
			event.preventDefault();
			resetSeoToMediaDefaults( getSeoScope( $( this ) ) );
		} );

		$( document ).on( 'input change', '.wpb_vc_param_value[name="seo_headline"]', function() {
			updateFilenameTitleWarning( getSeoScope( $( this ) ) );
		} );

		// The panel-open sync runs from setupParamGroupObserver() when the SEO
		// params are added to the DOM. WPBakery never triggers `vc.reload`, so
		// that can't be relied on.

		isSeoPrefillListenerBound = true;
	}

	/**
	 * Get the editor wrapper of a param (label, field and description).
	 *
	 * @param {Object} $field - The param's value field (jQuery object).
	 * @return {Object} jQuery object.
	 */
	function getParamWrapper( $field ) {
		const $wrapper = $field.closest( '.vc_shortcode-param' );
		return $wrapper.length ? $wrapper : $field.parent();
	}

	/**
	 * Make a param read-only (or editable again) without disabling it, so
	 * WPBakery still saves its value.
	 *
	 * Dropdowns: WPBakery 9 hides the native <select> behind its select2
	 * widget (`wpbselect2`), so the lock goes on the widget: a CSS rule on
	 * the wrapper class blocks clicks (it also covers a widget created after
	 * this runs), `select2:opening` is cancelled for keyboard access, and the
	 * widget's focusable box is taken out of the tab order. The hidden
	 * <select> itself is never touched: select2 copies its tabindex when it
	 * is created and re-applies it whenever the <select>'s attributes change,
	 * which would leave the dropdown out of the tab order after unlocking.
	 * A plain <select> (older WPBakery) is locked directly; its original
	 * tabindex is restored when it becomes editable.
	 *
	 * @param {Object}  $field   - The param's value field (jQuery object).
	 * @param {boolean} readOnly - Whether the field should be read-only.
	 */
	function setParamReadOnly( $field, readOnly ) {
		if ( ! $field.length ) {
			return;
		}

		const $wrapper = getParamWrapper( $field );

		if ( $field.is( 'select' ) ) {
			ensureReadOnlyStyles();

			$field.data( 'godamSeoReadOnly', readOnly );
			$field
				.off( 'select2:opening.godam-seo' )
				.on( 'select2:opening.godam-seo', function( event ) {
					if ( $( this ).data( 'godamSeoReadOnly' ) ) {
						event.preventDefault();
					}
				} );

			// `wpb-form-select` dropdowns become select2 widgets, possibly after
			// this runs.
			if ( $field.hasClass( 'wpb-form-select' ) || $field.data( 'select2' ) ) {
				const select2 = $field.data( 'select2' );
				const $select2 = $field.next( '.select2-container' );

				if ( $select2.length ) {
					// select2's own tab position, or the default when it has none.
					const ownTabindex = select2?.selection?._tabindex;
					const editableTabindex = undefined === ownTabindex || null === ownTabindex || '-1' === String( ownTabindex ) ? '0' : ownTabindex;
					$select2.find( '.select2-selection' ).attr( 'tabindex', readOnly ? '-1' : editableTabindex );
					$select2.attr( 'aria-readonly', readOnly ? 'true' : null );
				}
			} else {
				if ( undefined === $field.data( 'godamSeoTabindex' ) ) {
					$field.data( 'godamSeoTabindex', $field.attr( 'tabindex' ) ?? null );
				}
				$field.attr( 'aria-readonly', readOnly ? 'true' : null );
				$field.css( 'pointer-events', readOnly ? 'none' : '' );
				$field.attr( 'tabindex', readOnly ? '-1' : $field.data( 'godamSeoTabindex' ) );
			}
		} else {
			$field.prop( 'readonly', readOnly );
		}

		$wrapper.toggleClass( 'godam-wpb-seo-readonly', readOnly );
		$field.css( 'background-color', readOnly ? '#f0f0f1' : '' );
		$wrapper.css( 'opacity', readOnly ? '0.75' : '' );
	}

	/**
	 * Add the stylesheet that blocks clicks on read-only select2 dropdowns.
	 * Added once per page.
	 */
	function ensureReadOnlyStyles() {
		if ( document.getElementById( 'godam-wpb-seo-readonly-styles' ) ) {
			return;
		}

		$( '<style id="godam-wpb-seo-readonly-styles"></style>' )
			.text( '.godam-wpb-seo-readonly .select2-container{pointer-events:none;}.godam-wpb-seo-readonly .select2-container .select2-selection{background-color:#f0f0f1;}' )
			.appendTo( document.head );
	}

	/**
	 * Set a param's value and notify WPBakery, only when it changed.
	 *
	 * @param {Object} $field - The param's value field (jQuery object).
	 * @param {string} value  - New value.
	 */
	function setParamValue( $field, value ) {
		if ( ! $field.length ) {
			return;
		}

		const next = undefined === value || null === value ? '' : String( value );
		if ( String( $field.val() ?? '' ) !== next ) {
			$field.val( next ).trigger( 'change' );
		}
	}

	/**
	 * SEO values for a video, the same way the Gutenberg modal builds them.
	 *
	 * @param {Object} attachmentData - `/wp/v2/media/<id>` response.
	 * @return {Object} SEO values keyed by WPBakery param name.
	 */
	function getSeoParamValuesFromAttachment( attachmentData ) {
		return {
			// Google indexes HLS (.m3u8) but not DASH (.mpd), so prefer the HLS stream.
			seo_content_url: getFirstNonEmpty( attachmentData?.meta?.rtgodam_hls_transcoded_url, attachmentData?.source_url ),
			seo_headline: stripHtmlTags( getFirstNonEmpty( attachmentData?.title?.rendered, attachmentData?.title ) ),
			seo_description: stripHtmlTags( getFirstNonEmpty( attachmentData?.description?.rendered, attachmentData?.description ) ),
			seo_upload_date: attachmentData?.date_gmt ? appendTimezoneOffsetToUTC( attachmentData.date_gmt ) : '',
			seo_duration: getFirstNonEmpty( attachmentData?.video_duration_iso8601 ),
			seo_thumbnail_url: getFirstNonEmpty( attachmentData?.meta?.rtgodam_media_video_thumbnail ),
			seo_family_friendly: '1',
		};
	}

	/**
	 * Show the sync / override notice under "Override SEO", like the Gutenberg
	 * modal: an info notice when synced, a warning with "Reset to media library
	 * defaults" when overridden.
	 *
	 * @param {Object}  $scope     - Edit panel scope (jQuery object).
	 * @param {boolean} isOverride - Whether "Override SEO" is Yes.
	 * @param {boolean} hasVideo   - Whether a video is selected.
	 */
	function renderSeoNotice( $scope, isOverride, hasVideo ) {
		const $overrideField = getParamField( $scope, 'seo_override' );
		if ( ! $overrideField.length ) {
			return;
		}

		const $anchor = getParamWrapper( $overrideField );
		let $notice = $anchor.siblings( '.godam-wpb-seo-notice' );

		if ( ! $notice.length ) {
			$notice = $( '<div class="godam-wpb-seo-notice vc_col-xs-12" style="margin:8px 0;padding:8px 12px;border-left:4px solid #72aee6;background:#f0f6fc;"></div>' );
			$anchor.after( $notice );
		}

		if ( ! hasVideo ) {
			$notice.hide();
			return;
		}

		if ( isOverride ) {
			$notice
				.css( { borderLeftColor: '#dba617', background: '#fcf9e8' } )
				.empty()
				.append( document.createTextNode( __( 'You have overridden the default SEO. Changes to this video in the media library will not update the SEO for this element.', 'godam' ) + ' ' ) )
				.append(
					$( '<a href="#" class="godam-wpb-seo-reset"></a>' ).text( __( 'Reset to media library defaults', 'godam' ) ),
				)
				.show();
		} else {
			$notice
				.css( { borderLeftColor: '#72aee6', background: '#f0f6fc' } )
				.text( __( 'SEO data is automatically synced from the media library. Any changes made to the video in the media library will be reflected here.', 'godam' ) )
				.show();
		}
	}

	/**
	 * Fill and lock the SEO Settings fields to match the Gutenberg modal.
	 *
	 * Content URL, Upload Date, Duration and Thumbnail URL always come from
	 * the selected video and are read-only. Headline, Description and Is
	 * Family Friendly show the Media Library values and are read-only while
	 * "Override SEO" is No; they become editable (keeping their values) when
	 * it is Yes.
	 *
	 * @param {Object} $scope - Edit panel scope (jQuery object).
	 */
	function syncSeoPanel( $scope ) {
		const $overrideField = getParamField( $scope, 'seo_override' );
		if ( ! $overrideField.length ) {
			return;
		}

		const isOverride = '1' === String( $overrideField.val() );
		const attachmentId = parseInt( getParamField( $scope, 'id' ).val(), 10 );

		SEO_READONLY_FIELDS.forEach( ( name ) => setParamReadOnly( getParamField( $scope, name ), true ) );
		SEO_OVERRIDABLE_FIELDS.forEach( ( name ) => setParamReadOnly( getParamField( $scope, name ), ! isOverride ) );
		renderSeoNotice( $scope, isOverride, !! attachmentId );

		if ( ! attachmentId ) {
			return;
		}

		// Only the latest call may write, so a slow lookup for a previously
		// selected video can't overwrite the current one.
		const requestId = ( $overrideField.data( 'godamSeoSyncId' ) || 0 ) + 1;
		$overrideField.data( 'godamSeoSyncId', requestId );

		fetchAttachmentData( attachmentId ).then( ( attachmentData ) => {
			if ( ! attachmentData || $overrideField.data( 'godamSeoSyncId' ) !== requestId ) {
				return;
			}

			const values = getSeoParamValuesFromAttachment( attachmentData );
			const overrideNow = '1' === String( $overrideField.val() );

			// Apply the lock again: when the panel has just opened, WPBakery may
			// only now have created the select2 widget for Family Friendly.
			SEO_OVERRIDABLE_FIELDS.forEach( ( name ) => setParamReadOnly( getParamField( $scope, name ), ! overrideNow ) );

			SEO_READONLY_FIELDS.forEach( ( name ) => setParamValue( getParamField( $scope, name ), values[ name ] ) );

			if ( ! overrideNow ) {
				SEO_OVERRIDABLE_FIELDS.forEach( ( name ) => setParamValue( getParamField( $scope, name ), values[ name ] ) );
			}
		} ).catch( () => {
			// Leave the fields as they are; the schema is built server-side anyway.
		} );
	}

	/**
	 * "Reset to media library defaults": restore the Media Library values and
	 * switch "Override SEO" back to No.
	 *
	 * @param {Object} $scope - Edit panel scope (jQuery object).
	 */
	function resetSeoToMediaDefaults( $scope ) {
		const attachmentId = parseInt( getParamField( $scope, 'id' ).val(), 10 );
		const $overrideField = getParamField( $scope, 'seo_override' );

		if ( ! attachmentId || ! $overrideField.length ) {
			return;
		}

		fetchAttachmentData( attachmentId ).then( ( attachmentData ) => {
			if ( ! attachmentData ) {
				return;
			}

			const values = getSeoParamValuesFromAttachment( attachmentData );
			SEO_OVERRIDABLE_FIELDS.forEach( ( name ) => setParamValue( getParamField( $scope, name ), values[ name ] ) );
			setParamValue( $overrideField, '0' );
		} ).catch( () => {} );
	}

	/**
	 * Show or hide a warning in the SEO Settings tab when the video's SEO title
	 * looks like a raw file name (hyphens/underscores and no spaces, or the
	 * file name itself).
	 *
	 * Uses the custom headline when SEO is overridden, otherwise the Media
	 * Library title the schema is built from.
	 *
	 * @param {Object} $scope - Edit panel scope (jQuery object).
	 */
	function updateFilenameTitleWarning( $scope ) {
		const $overrideField = getParamField( $scope, 'seo_override' );

		if ( ! $overrideField.length ) {
			return;
		}

		const $overrideParam = $overrideField.closest( '.vc_shortcode-param' );
		const $anchor = $overrideParam.length ? $overrideParam : $overrideField.parent();
		let $warning = $anchor.siblings( '.godam-wpb-seo-filename-warning' );

		if ( ! $warning.length ) {
			$warning = $( '<div class="godam-wpb-seo-filename-warning vc_col-xs-12" style="display:none;margin:8px 0;padding:8px 12px;border-left:4px solid #dba617;background:#fcf9e8;"></div>' );
			$anchor.after( $warning );
		}

		// Sequence the async lookup: only the latest call for this panel may
		// update the warning, so a slow earlier request (e.g. for the previous
		// video) can't overwrite a newer result.
		const requestId = ( $warning.data( 'godamRequestId' ) || 0 ) + 1;
		$warning.data( 'godamRequestId', requestId );
		const isStale = () => $warning.data( 'godamRequestId' ) !== requestId;

		const attachmentId = parseInt( getParamField( $scope, 'id' ).val(), 10 );
		if ( ! attachmentId ) {
			$warning.hide();
			return;
		}

		const seoOverrideEnabled = '1' === String( $overrideField.val() );

		fetchAttachmentData( attachmentId ).then( ( attachmentData ) => {
			if ( isStale() ) {
				return;
			}

			const fileName = getFirstNonEmpty( attachmentData?.source_url, attachmentData?.url, attachmentData?.filename );
			const title = seoOverrideEnabled
				? String( getParamField( $scope, 'seo_headline' ).val() || '' )
				: stripHtmlTags( getFirstNonEmpty( attachmentData?.title?.rendered, attachmentData?.title ) );

			if ( ! isFilenameLikeTitle( title, fileName ) ) {
				$warning.hide();
				return;
			}

			$warning.text(
				seoOverrideEnabled
					? __( 'This title looks like a file name. Search engines show it as the video title, so use a descriptive title with spaces instead.', 'godam' )
					: __( 'This video\'s title looks like a file name. Search engines show it as the video title. Edit the title in the Media Library, or set "Override SEO" to Yes and enter a descriptive headline.', 'godam' ),
			).show();
		} ).catch( () => {
			if ( ! isStale() ) {
				$warning.hide();
			}
		} );
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
					$preview = $( '<div class="video-selector-preview" data-test-id="godam-wpb-preview-video" style="margin-top: 10px;"></div>' );
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
					$removeButton = $( `<button type="button" class="button video-selector-remove" data-test-id="godam-wpb-button-remove-video" style="margin-left: 5px;">${ __( 'Remove', 'godam' ) }</button>` );
					$buttonsWrapper.append( $removeButton );
				}
			} );
		} );

		isVirtualAttachmentListenerBound = true;
	}
}( window.jQuery ) );
