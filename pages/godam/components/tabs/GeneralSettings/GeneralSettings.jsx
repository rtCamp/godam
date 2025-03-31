/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import {
	ToggleControl,
	Notice,
	Panel,
	PanelBody,
	Button,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { useSaveMediaSettingsMutation } from '../../../redux/api/media-settings.js';
import { updateMediaSetting } from '../../../redux/slice/media-settings.js';
import BrandImageSelector from './BrandImageSelector.jsx';
import ColorPickerButton from '../../../../video-editor/components/ColorPickerButton.js';

const GeneralSettings = () => {
	const [ notice, setNotice ] = useState( {
		message: '',
		status: 'success',
		isVisible: false,
	} );

	const mediaSettings = useSelector( ( state ) => state.mediaSettings );

	const dispatch = useDispatch();

	const [ saveMediaSettings ] = useSaveMediaSettingsMutation();

	const handleMediaFolderOrganization = ( value ) => {
		dispatch( updateMediaSetting(
			{
				category: 'general',
				key: 'enable_folder_organization',
				value,
			},
		) );
	};

	const handleBrandColorChange = ( value ) => {
		dispatch( updateMediaSetting(
			{
				category: 'general',
				key: 'brand_color',
				value,
			},
		) );
	};

	const handleSaveSettings = async () => {
		try {
			const response = await saveMediaSettings( mediaSettings ).unwrap();

			if ( response?.status === 'success' ) {
				setNotice( {
					message: __( 'Settings saved successfully.', 'godam' ),
					status: 'success',
					isVisible: true,
				} );
			} else {
				setNotice( {
					message: __( 'Failed to save settings.', 'godam' ),
					status: 'error',
					isVisible: true,
				} );
			}
		} catch ( error ) {
			setNotice( {
				message: __( 'Failed to save settings.', 'godam' ),
				status: 'error',
				isVisible: true,
			} );
		}
	};

	return (
		<div>
			{ notice?.isVisible && (
				<Notice
					className="mb-4"
					status={ notice.status }
					onRemove={ () => setNotice( { ...notice, isVisible: false } ) }
				>
					{ notice.message }
				</Notice>
			) }

			<Panel header={ __( 'General Settings', 'godam' ) } className="godam-panel">
				<PanelBody opened={ true }>
					<div className="flex flex-col gap-4">
						<ToggleControl
							__nextHasNoMarginBottom
							className="godam-toggle"
							label={ __(
								'Enable Folder Organization in Media Library.',
								'godam',
							) }
							help={ __(
								'Keep this option enabled to organize media into folders within the media library. Disabling it will remove folder organization.',
								'godam',
							) }
							checked={ mediaSettings?.general?.enable_folder_organization || true }
							onChange={ handleMediaFolderOrganization }
						/>
					</div>

					<BrandImageSelector mediaSettings={ mediaSettings } updateMediaSettings={ updateMediaSetting } />

					<div className="form-group">

						<label
							htmlFor="brand-color"
							className="easydam-label"
						>
							{ __( 'Brand Color', 'godam' ) }
						</label>

						<ColorPickerButton
							label={ __( 'Brand Color', 'godam' ) }
							value={ mediaSettings?.general?.brand_color }
							onChange={ handleBrandColorChange }
						/>

						<p className="text-xsm text-gray-600 mb-2">
							{ __( 'Select a brand color to apply to the video block. This can be overridden for individual videos by the video editor', 'godam' ) }
						</p>
					</div>

				</PanelBody>
			</Panel>

			<Button
				variant="primary"
				className="godam-button"
				onClick={ handleSaveSettings }
			>
				{ __( 'Save Settings', 'godam' ) }
			</Button>
		</div>
	);
};

export default GeneralSettings;
