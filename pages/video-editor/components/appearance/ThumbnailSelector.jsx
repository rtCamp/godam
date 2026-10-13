/**
 * WordPress dependencies
 */
import { useState, useEffect, useCallback } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Video thumbnail selector for the Settings tab.
 *
 * Reuses the existing media-library thumbnail endpoints: lists the video's
 * auto-generated + custom thumbnails, lets the user pick the default (saved
 * immediately via `set-video-thumbnail`), upload a custom one, or remove a
 * custom one. Matches the design's grid (upload tile + selectable thumbnails).
 *
 * @param {Object} props              Props.
 * @param {number} props.attachmentID WordPress attachment id for the video.
 * @return {JSX.Element|null} The thumbnail selector, or null without an attachment.
 */
const ThumbnailSelector = ( { attachmentID } ) => {
	const [ autoThumbnails, setAutoThumbnails ] = useState( [] );
	const [ customThumbnails, setCustomThumbnails ] = useState( [] );
	const [ selected, setSelected ] = useState( '' );
	const [ isLoading, setIsLoading ] = useState( false );

	const fetchThumbnails = useCallback( () => {
		if ( ! attachmentID ) {
			return;
		}
		setIsLoading( true );
		apiFetch( {
			path: `/godam/v1/media-library/get-video-thumbnail?attachment_id=${ encodeURIComponent( attachmentID ) }`,
		} )
			.then( ( response ) => {
				if ( ! response?.success ) {
					return;
				}
				const {
					thumbnails = [],
					customThumbnails: custom = [],
					selected: sel = '',
				} = response.data || {};
				setAutoThumbnails( thumbnails );
				setCustomThumbnails( custom );
				setSelected( sel );
			} )
			.catch( () => {} )
			.finally( () => setIsLoading( false ) );
	}, [ attachmentID ] );

	useEffect( () => {
		fetchThumbnails();
	}, [ fetchThumbnails ] );

	const selectThumbnail = ( url ) => {
		setSelected( url );
		apiFetch( {
			path: '/godam/v1/media-library/set-video-thumbnail',
			method: 'POST',
			data: { attachment_id: attachmentID, thumbnail_url: url },
		} ).catch( () => {} );
	};

	const uploadCustom = () => {
		const fileFrame = wp.media( {
			title: __( 'Select Video Thumbnail', 'godam' ),
			button: { text: __( 'Use this thumbnail', 'godam' ) },
			library: { type: 'image' },
			multiple: false,
		} );

		fileFrame.on( 'select', () => {
			const attachment = fileFrame.state().get( 'selection' ).first().toJSON();
			if ( attachment?.type !== 'image' ) {
				return;
			}
			const formData = new FormData();
			formData.append( 'attachment_id', attachmentID );
			formData.append( 'thumbnail_url', attachment.url );
			apiFetch( {
				path: '/godam/v1/media-library/upload-custom-video-thumbnail',
				method: 'POST',
				body: formData,
			} )
				.then( ( res ) => {
					if ( res?.success ) {
						fetchThumbnails();
					}
				} )
				.catch( () => {} );
		} );

		fileFrame.open();
	};

	const deleteCustom = ( url ) => {
		const formData = new FormData();
		formData.append( 'attachment_id', attachmentID );
		formData.append( 'thumbnail_url', url );
		apiFetch( {
			path: '/godam/v1/media-library/delete-custom-video-thumbnail',
			method: 'POST',
			body: formData,
		} )
			.then( ( res ) => {
				if ( res?.success ) {
					fetchThumbnails();
				}
			} )
			.catch( () => {} );
	};

	if ( ! attachmentID ) {
		return null;
	}

	const renderTile = ( url, isCustom, index ) => (
		<div key={ url } className="godam-ve-thumb-tile-wrap">
			<button
				type="button"
				data-test-id={ `godam-video-editor-element-thumbnail-${ isCustom ? 'custom' : 'auto' }-${ index }` }
				className={ `godam-ve-thumb-tile${ selected === url ? ' is-selected' : '' }` }
				onClick={ () => selectThumbnail( url ) }
				aria-pressed={ selected === url }
				aria-label={ __( 'Select thumbnail', 'godam' ) }
			>
				<img src={ url } alt="" draggable="false" />
				{ selected === url && (
					<span className="godam-ve-thumb-tile__check" aria-hidden="true">✓</span>
				) }
			</button>
			{ isCustom && (
				<button
					type="button"
					data-test-id={ `godam-video-editor-button-delete-thumbnail-custom-${ index }` }
					className="godam-ve-thumb-tile__delete"
					onClick={ () => deleteCustom( url ) }
					aria-label={ __( 'Remove custom thumbnail', 'godam' ) }
				>
					&#x2715;
				</button>
			) }
		</div>
	);

	return (
		<div className="godam-ve-thumb">
			{ isLoading ? (
				<div className="godam-ve-thumb__spinner"><Spinner /></div>
			) : (
				<div className="godam-ve-thumb-grid">
					<button
						type="button"
						data-test-id="godam-video-editor-button-upload-thumbnail"
						className="godam-ve-thumb-tile godam-ve-thumb-upload"
						onClick={ uploadCustom }
						aria-label={ __( 'Upload custom thumbnail', 'godam' ) }
					>
						<span aria-hidden="true">+</span>
					</button>
					{ customThumbnails.map( ( url, index ) => renderTile( url, true, index ) ) }
					{ autoThumbnails.map( ( url, index ) => renderTile( url, false, index ) ) }
				</div>
			) }
		</div>
	);
};

export default ThumbnailSelector;
