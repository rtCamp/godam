/**
 * External dependencies
 */
import { useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { CustomSelectControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

const QUALITY_OPTIONS = [
	{ key: '100', name: __( 'Highest quality (100%)', 'godam' ) },
	{ key: '80', name: __( 'Higher quality (80%)', 'godam' ) },
	{ key: '60', name: __( 'Medium quality (60%)', 'godam' ) },
	{ key: '40', name: __( 'Lower quality (40%)', 'godam' ) },
	{ key: '20', name: __( 'Lowest quality (20%)', 'godam' ) },
];

const VideoCompressQuality = ( { handleSettingChange } ) => {
	const videoQuality = useSelector( ( state ) => state.mediaSettings.video?.video_compress_quality );
	const selectedOption = QUALITY_OPTIONS.find( ( option ) => option.key === String( videoQuality ) ) || QUALITY_OPTIONS[ 0 ];

	return (
		<div className="godam-form-group" data-test-id="godam-settings-video-control-quality">
			<CustomSelectControl
				__next40pxDefaultSize
				label={ __( 'Video Quality', 'godam' ) }
				options={ QUALITY_OPTIONS }
				value={ selectedOption }
				onChange={ ( { selectedItem } ) => handleSettingChange( 'video_compress_quality', Number( selectedItem.key ) ) }
			/>
			<p className="godam-settings-help">
				{ __( 'Select the video quality.', 'godam' ) }
			</p>
		</div>
	);
};

export default VideoCompressQuality;
