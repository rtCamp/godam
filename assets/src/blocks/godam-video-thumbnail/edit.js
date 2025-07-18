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

/**
 * Edit component for the GoDAM Video Thumbnail block.
 *
 * @param {Object}   props
 * @param {Object}   props.attributes    - The block attributes.
 * @param {Function} props.setAttributes - Function to update block attributes.
 *
 * @return {JSX.Element} The rendered video thumbnail block.
 */
function Edit( { attributes, setAttributes } ) {
	const { linkToVideo, showPlayButton, openInNewTab } = attributes;
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
						label={ __( 'Show play button overlay', 'godam' ) }
						checked={ showPlayButton }
						onChange={ ( value ) => setAttributes( { showPlayButton: value } ) }
						help={ showPlayButton
							? __( 'Play button will be displayed.', 'godam' )
							: __( 'No play button will be displayed.', 'godam' )
						}
					/>
					<ToggleControl
						label={ __( 'Link to post', 'godam' ) }
						checked={ linkToVideo }
						onChange={ ( value ) => setAttributes( { linkToVideo: value } ) }
						help={ linkToVideo
							? __( 'Thumbnail will link to the video page.', 'godam' )
							: __( 'Thumbnail will not be linked.', 'godam' )
						}
					/>
					{ linkToVideo && (
						<ToggleControl
							label={ __( 'Open in new tab', 'godam' ) }
							checked={ openInNewTab }
							onChange={ ( value ) => setAttributes( { openInNewTab: value } ) }
							help={ openInNewTab
								? __( 'Link will open in a new tab.', 'godam' )
								: __( 'Link will open in the same tab.', 'godam' )
							}
						/>
					) }
				</PanelBody>
			</InspectorControls>
			<div { ...blockProps }>
				<div className="godam-editor-video-thumbnail">

					{ /* Placeholder text */ }
					<span className="godam-editor-video-label">
						{ __( 'GoDAM Video Thumbnail', 'godam' ) }
					</span>

					{ /* Play button overlay */ }
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
