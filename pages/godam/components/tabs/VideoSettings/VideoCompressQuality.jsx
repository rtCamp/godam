/**
 * External dependencies
 */
import { useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Panel, PanelBody, SelectControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

const QUALITY_OPTIONS = [
	{ label: __( 'No compression' ), value: 100 },
	{ label: __( 'High quality', 'godam' ), value: 80 },
	{ label: __( 'Medium quality', 'godam' ), value: 60 },
	{ label: __( 'Low quality', 'godam' ), value: 40 },
	{ label: __( 'very low quality', 'godam' ), value: 20 },
];

const VideoCompressQuality = ( { handleSettingChange } ) => {
	const videoQuality = useSelector( ( state ) => state.mediaSettings.video?.video_compress_quality );

	return (
		<Panel
			heading={ __( 'Video Thumbnails', 'godam' ) }
			className="godam-panel"
		>
			<PanelBody>
				<div className="godam-form-group">
					<SelectControl
						className="godam-select"
						value={ videoQuality }
						onChange={ ( value ) => {
							handleSettingChange( 'video_compress_quality', value );
						} }
						label={ __( 'Video compression quality', 'godam' ) }
						options={ QUALITY_OPTIONS }
					/>
					<div className="help-text">
						{ __( 'Select the video compression quality.', 'godam' ) }
					</div>
				</div>
			</PanelBody>

		</Panel>
	);
};

export default VideoCompressQuality;
