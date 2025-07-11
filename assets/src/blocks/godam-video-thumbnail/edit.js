/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import {
	useBlockProps,
	InspectorControls,
} from '@wordpress/block-editor';
import {
	PanelBody,
	ToggleControl,
} from '@wordpress/components';

/**
 * Internal dependencies
 */
import './editor.scss';

function Edit( { attributes, setAttributes } ) {
	const { linkToVideo, showPlayButton } = attributes;
	const blockProps = useBlockProps(
		{
			className: 'godam-editor-video-item',
		},
	);

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Thumbnail Settings', 'godam' ) }>
					<ToggleControl
						label={ __( 'Link to post', 'godam' ) }
						checked={ linkToVideo }
						onChange={ ( value ) => setAttributes( { linkToVideo: value } ) }
						help={ linkToVideo
							? __( 'Thumbnail will link to the video page.', 'godam' )
							: __( 'Thumbnail will not be linked.', 'godam' )
						}
					/>
					<ToggleControl
						label={ __( 'Show play button overlay', 'godam' ) }
						checked={ showPlayButton }
						onChange={ ( value ) => setAttributes( { showPlayButton: value } ) }
						help={ showPlayButton
							? __( 'Play button will be displayed.', 'godam' )
							: __( 'No play button will be displayed.', 'godam' )
						}
					/>
				</PanelBody>
			</InspectorControls>
			<div { ...blockProps }>
				<div className="godam-editor-video-thumbnail">
					<span className="godam-editor-video-label">
						{ __( 'GoDAM Video Thumbnail', 'godam' ) }
					</span>
					{ showPlayButton && (
						<div className="godam-editor-video-play-button">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="60" height="60" aria-hidden="true" focusable="false">
								<path d="M8 5v14l11-7z" fill="currentColor"></path>
							</svg>
						</div>
					) }
				</div>
			</div>
		</>
	);
}

export default Edit;
