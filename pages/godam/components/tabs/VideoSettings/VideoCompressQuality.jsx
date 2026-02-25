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
	{ label: __( 'Highest quality (100%)', 'godam' ), value: 100 },
	{ label: __( 'Higher quality (80%)', 'godam' ), value: 80 },
	{ label: __( 'Medium quality (60%)', 'godam' ), value: 60 },
	{ label: __( 'Lower quality (40%)', 'godam' ), value: 40 },
	{ label: __( 'Lowest quality (20%)', 'godam' ), value: 20 },
];

const VideoCompressQuality = ( { handleSettingChange } ) => {
	const videoQuality = useSelector( ( state ) => state.mediaSettings.video?.video_compress_quality );

	return (
		<Panel
			heading={ __( 'Video Quality', 'godam' ) }
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
						label={ __( 'Video quality', 'godam' ) }
						options={ QUALITY_OPTIONS }
					/>
					<div className="help-text">
						{ __( 'Select the video quality.', 'godam' ) }
					</div>
				</div>
			</PanelBody>

		</Panel>
	);
};

export default VideoCompressQuality;
