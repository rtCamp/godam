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
	const { linkToVideo } = attributes;

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
				</PanelBody>
			</InspectorControls>
			<div { ...blockProps }>
				<div className="godam-editor-video-thumbnail">
					<span className="godam-editor-video-label">
						{ __( 'GoDAM Video Thumbnail', 'godam' ) }
					</span>
				</div>
			</div>
		</>
	);
}

export default Edit;
