/**
 * WordPress dependencies
 */
import { Panel, PanelBody, SelectControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

const QUALITY_OPTIONS = [
	{ label: __( 'No compression' ), value: 100 },
	{ label: __( 'Highest quality', 'godam' ), value: 80 },
	{ label: __( 'Medium quality', 'godam' ), value: 60 },
	{ label: __( 'Lower Compression', 'godam' ), value: 40 },
	{ label: __( 'Lowest compression', 'godam' ), value: 20 },
];

const VideoCompressQuality = ( { mediaSettings, handleSettingChange } ) => {
	const videoQuality = mediaSettings.video_compress_quality || 100;

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
