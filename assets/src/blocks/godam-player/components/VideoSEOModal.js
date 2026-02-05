/**
 * External dependencies
 */
import { useEffect, useState, useCallback } from 'react';

/**
 * WordPress dependencies
 */
import {
	Modal,
	Button,
	TextControl,
	TextareaControl,
	ToggleControl,
	Notice,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import './video-seo-modal.scss';
import { isSEODataEmpty, appendTimezoneOffsetToUTC, stripHtmlTags } from '../utils';

/**
 * Video SEO Modal component
 *
 * @param {*}        param0
 * @param {boolean}  param0.isOpen        - Whether the modal is open
 * @param {Function} param0.setIsOpen     - Function to set modal open state
 * @param {Object}   param0.attributes    - Block attributes
 * @param {Function} param0.setAttributes - Function to set block attributes
 *
 * @return {JSX.Element|null} returns the Video SEO Modal component or null if not open
 */
export default function VideoSEOModal( { isOpen, setIsOpen, attributes, setAttributes } ) {
	const [ videoData, setVideoData ] = useState( {} );
	const [ mediaSEOData, setMediaSEOData ] = useState( null );
	const [ isLoadingMediaSEO, setIsLoadingMediaSEO ] = useState( false );
	const [ seoOverride, setSeoOverride ] = useState( attributes?.seoOverride || false );

	/**
	 * Fetch SEO data from the media library attachment.
	 */
	const fetchMediaSEOData = useCallback( async () => {
		if ( ! attributes?.id || isNaN( Number( attributes.id ) ) ) {
			return null;
		}

		setIsLoadingMediaSEO( true );
		try {
			const response = await apiFetch( { path: `/wp/v2/media/${ attributes.id }` } );

			const seoFromMedia = {
				contentUrl: response.meta?.rtgodam_transcoded_url || response.source_url || '',
				headline: response.title?.rendered || '',
				description: stripHtmlTags( response.description?.rendered || '' ),
				uploadDate: appendTimezoneOffsetToUTC( response.date_gmt || '' ),
				duration: response.video_duration_iso8601 || '',
				thumbnailUrl: response.meta?.rtgodam_media_video_thumbnail || '',
				isFamilyFriendly: true,
			};

			setMediaSEOData( seoFromMedia );
			return seoFromMedia;
		} catch ( error ) {
			// eslint-disable-next-line no-console
			console.error( 'Failed to fetch media SEO data:', error );
			return null;
		} finally {
			setIsLoadingMediaSEO( false );
		}
	}, [ attributes?.id ] );

	useEffect( () => {
		if ( ! isOpen ) {
			return;
		}

		// Sync local override state with attributes
		setSeoOverride( attributes?.seoOverride || false );

		// Fetch media library SEO data when modal opens
		fetchMediaSEOData();

		// Always initialize videoData when modal opens or attributes change
		const defaultVideoData = {
			contentUrl: '',
			headline: '',
			description: '',
			uploadDate: '',
			duration: '',
			thumbnailUrl: '',
			isFamilyFriendly: true,
		};

		// If SEO data exists in attributes, use it; otherwise use defaults
		const initialVideoData = {
			contentUrl: attributes?.seo?.contentUrl || defaultVideoData.contentUrl,
			headline: attributes?.seo?.headline || defaultVideoData.headline,
			description: attributes?.seo?.description || defaultVideoData.description,
			uploadDate: attributes?.seo?.uploadDate || defaultVideoData.uploadDate,
			duration: attributes?.seo?.duration || defaultVideoData.duration,
			thumbnailUrl: attributes?.seo?.thumbnailUrl || defaultVideoData.thumbnailUrl,
			isFamilyFriendly: attributes?.seo?.isFamilyFriendly !== undefined ? attributes.seo.isFamilyFriendly : defaultVideoData.isFamilyFriendly,
		};

		// Always update the local state with the latest data from attributes
		setVideoData( initialVideoData );

		// Only initialize attributes.seo if it's empty (for backward compatibility)
		if ( isSEODataEmpty( attributes.seo ) ) {
			setAttributes( {
				seo: initialVideoData,
			} );
		}
	}, [ attributes.seo, attributes?.seoOverride, isOpen, setAttributes, fetchMediaSEOData ] ); // Depend on seo attribute and modal state

	const updateField = ( field, value ) => {
		setVideoData( { ...videoData, [ field ]: value } );
	};

	/**
	 * Handle toggling the SEO override option.
	 *
	 * @param {boolean} value - New override value.
	 */
	const handleOverrideToggle = ( value ) => {
		setSeoOverride( value );

		if ( ! value && mediaSEOData ) {
			// Switching back to media library defaults - restore from media
			setVideoData( mediaSEOData );
		}
	};

	/**
	 * Reset SEO to media library defaults.
	 */
	const resetToMediaDefaults = async () => {
		const freshMediaSEO = await fetchMediaSEOData();
		if ( freshMediaSEO ) {
			setVideoData( freshMediaSEO );
			setSeoOverride( false );
		}
	};

	const closeModal = () => {
		setIsOpen( false );
		// Reset videoData to current attributes when modal closes without saving
		const currentSEOData = {
			contentUrl: attributes?.seo?.contentUrl || '',
			headline: attributes?.seo?.headline || '',
			description: attributes?.seo?.description || '',
			uploadDate: attributes?.seo?.uploadDate || '',
			duration: attributes?.seo?.duration || '',
			thumbnailUrl: attributes?.seo?.thumbnailUrl || '',
			isFamilyFriendly: attributes?.seo?.isFamilyFriendly !== undefined ? attributes.seo.isFamilyFriendly : true,
		};
		setVideoData( currentSEOData );
		setSeoOverride( attributes?.seoOverride || false );
	};

	const saveData = () => {
		setAttributes( {
			seo: videoData,
			seoOverride,
		} );
		closeModal();
	};

	if ( ! isOpen ) {
		return null;
	}

	// Check if fields should be editable (only when override is enabled)
	const isFieldsDisabled = ! seoOverride;

	return (
		<Modal
			title={ __( 'Video SEO Schema', 'godam' ) }
			onRequestClose={ closeModal }
			className="godam-seo-modal"
		>
			{ /* Override Toggle Section */ }
			<div className="godam-seo-modal__override-section">
				<ToggleControl
					className="godam-seo-modal__override-toggle"
					label={ __( 'Override default SEO', 'godam' ) }
					checked={ seoOverride }
					onChange={ handleOverrideToggle }
					help={ seoOverride
						? __( 'SEO data is customized for this block. Changes to the media library will not affect this block.', 'godam' )
						: __( 'SEO data is synced from the media library. Enable to customize SEO for this specific block.', 'godam' )
					}
				/>

				{ ! seoOverride && (
					<Notice status="info" isDismissible={ false } className="godam-seo-modal__notice">
						{ __( 'SEO data is automatically synced from the media library. Any changes made to the video in the media library will be reflected here.', 'godam' ) }
					</Notice>
				) }

				{ seoOverride && (
					<Notice status="warning" isDismissible={ false } className="godam-seo-modal__notice">
						{ __( 'You have overridden the default SEO. Changes to this video in the media library will not update the SEO for this block.', 'godam' ) }
						<Button
							variant="link"
							onClick={ resetToMediaDefaults }
							disabled={ isLoadingMediaSEO }
							style={ { marginLeft: '8px' } }
						>
							{ __( 'Reset to media library defaults', 'godam' ) }
						</Button>
					</Notice>
				) }
			</div>

			<TextControl
				className="godam-seo-modal__property"
				label={ __( 'Content URL', 'godam' ) }
				value={ videoData?.contentUrl || '' }
				onChange={ ( value ) => updateField( 'contentUrl', value ) }
				help={ __( 'URL of the video content can be MOV, MP4, MPD. Example: https://www.example.com/video.mp4', 'godam' ) }
				disabled={ true }
			/>
			<TextControl
				className="godam-seo-modal__property"
				label={ __( 'Headline *', 'godam' ) }
				value={ videoData?.headline || '' }
				onChange={ ( value ) => updateField( 'headline', value ) }
				help={ __( 'Title of the video', 'godam' ) }
				disabled={ isFieldsDisabled }
			/>
			<TextareaControl
				className={ `godam-seo-modal__property${ ! videoData?.description?.trim() ? ' godam-seo-modal__property--warning' : '' }` }
				label={ __( 'Description', 'godam' ) }
				value={ videoData?.description || '' }
				onChange={ ( value ) => updateField( 'description', value ) }
				help={ ! videoData?.description?.trim()
					? __( 'It is recommended to add a description for better video SEO.', 'godam' )
					: __( 'Description of the video', 'godam' )
				}
				disabled={ isFieldsDisabled }
			/>
			<TextControl
				className="godam-seo-modal__property"
				label={ __( 'Upload Date', 'godam' ) }
				help={ __( 'Format: YYYY-MM-DD', 'godam' ) }
				value={ videoData?.uploadDate || '' }
				onChange={ ( value ) => updateField( 'uploadDate', value ) }
				disabled={ true }
			/>
			<TextControl
				className="godam-seo-modal__property"
				label={ __( 'Duration', 'godam' ) }
				disabled={ true }
				help={ __( 'ISO 8601 format. Example: PT1H30M', 'godam' ) }
				value={ videoData?.duration || '' }
				onChange={ ( value ) => updateField( 'duration', value ) }
			/>
			<TextControl
				className="godam-seo-modal__property"
				label={ __( 'Video Thumbnail URL', 'godam' ) }
				value={ videoData?.thumbnailUrl || '' }
				onChange={ ( value ) => updateField( 'thumbnailUrl', value ) }
				help={ __( 'URL of the video thumbnail. Example: https://www.example.com/thumbnail.jpg', 'godam' ) }
				disabled={ true }
			/>
			<ToggleControl
				className="godam-seo-modal__property"
				label={ __( 'Is Family Friendly', 'godam' ) }
				checked={ videoData?.isFamilyFriendly || false }
				onChange={ ( value ) => updateField( 'isFamilyFriendly', value ) }
				help={ __( 'Is the video suitable for all audiences?', 'godam' ) }
				disabled={ isFieldsDisabled }
			/>

			<div style={ { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' } }>
				<Button variant="tertiary" onClick={ closeModal }>
					{ __( 'Cancel', 'godam' ) }
				</Button>
				<Button variant="primary" onClick={ saveData }>
					{ __( 'Save', 'godam' ) }
				</Button>
			</div>
		</Modal>
	);
}
