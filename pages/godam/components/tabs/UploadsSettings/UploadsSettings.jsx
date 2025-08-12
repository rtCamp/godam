/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import {
	Notice,
	Panel,
	PanelBody,
	Button,
	ToggleControl,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { useSaveMediaSettingsMutation } from '../../../redux/api/media-settings';
import {
	formatSize,
	getMaxUploadSize,
	getGodamMaxUploadSize,
	scrollToTop,
} from '../../../utils';
import { updateMediaSetting } from '../../../redux/slice/media-settings';

import MediaMigration from './MediaMigration.jsx';

const UploadsSettings = () => {
	const dispatch = useDispatch();
	const mediaSettings = useSelector( ( state ) => state.mediaSettings );

	const [ saveMediaSettings, { isLoading: saveMediaSettingLoading } ] = useSaveMediaSettingsMutation();

	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );

	const showNotice = ( message, status = 'success' ) => {
		setNotice( { message, status, isVisible: true } );
		scrollToTop();
	};

	const handleSettingChange = ( key, value ) => {
		dispatch( updateMediaSetting( { category: 'uploads', key, value } ) );
	};

	const handleSaveSettings = async () => {
		try {
			const response = await saveMediaSettings( { settings: { uploads: mediaSettings?.uploads } } ).unwrap();

			if ( response?.status === 'success' ) {
				showNotice( __( 'Settings saved successfully.', 'godam' ) );
			} else {
				showNotice( __( 'Failed to save settings.', 'godam' ), 'error' );
			}
		} catch ( error ) {
			showNotice( __( 'Failed to save settings.', 'godam' ), 'error' );
		}
	};

	const getFileUploadSize = () => {
		if ( mediaSettings.uploads?.offload_media ) {
			return formatSize( getGodamMaxUploadSize() );
		}

		return formatSize( getMaxUploadSize() );
	};

	return (
		<>
			{ notice.isVisible && (
				<Notice
					className="mb-4"
					status={ notice.status }
					onRemove={ () => setNotice( { ...notice, isVisible: false } ) }
				>
					{ notice.message }
				</Notice>
			) }

			<Panel header={ __( 'Uploads Settings', 'godam' ) } className="godam-panel">
				<PanelBody opened>

					<Notice
						className="mb-4"
						status={ 'warning' }
						isDismissible={ false }
					>
						{ sprintf(
							// translators: %s: Maximum file upload size (e.g. "500 MB")
							__( 'Enabling the Offload Media option allows you to upload files up to %s in size.', 'godam' ),
							getFileUploadSize(),
						) }
					</Notice>

					<ToggleControl
						__nextHasNoMarginBottom
						className="godam-toggle godam-margin-bottom"
						label={ __( 'Offload Media?', 'godam' ) }
						help={ __( 'Offload media to the storage provider and distribute it using the GoDAM CDN.', 'godam' ) }
						checked={ mediaSettings?.uploads?.offload_media }
						onChange={ ( value ) => handleSettingChange( 'offload_media', value ) }
					/>
				</PanelBody>
			</Panel>
			{ mediaSettings.uploads?.offload_media && (
				<MediaMigration />
			) }
			<Button
				variant="primary"
				className="godam-button"
				onClick={ handleSaveSettings }
				isBusy={ saveMediaSettingLoading }
				disabled={ saveMediaSettingLoading }
			>
				{ __( 'Save Settings', 'godam' ) }
			</Button>
		</>
	);
};

export default UploadsSettings;
