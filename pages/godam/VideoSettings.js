/* global userData */

/**
 * WordPress dependencies
 */
import { ToggleControl, TextControl, SelectControl, Modal, Button, Notice, CheckboxControl, Panel, PanelBody, PanelRow } from '@wordpress/components';
import { useState, useEffect, useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { lock, unlock } from '@wordpress/icons';

const GODAM_API_BASE = 'https://app.godam.io';
const restURL = window.godamRestRoute.url || '';

const VideoSettings = ( { isPremiumUser, mediaSettings, licenseKey, setLicenseKey, saveMediaSettings, verifyLicenseFromUrl } ) => {
	const [ syncFromEasyDAM, setSyncFromEasyDAM ] = useState( mediaSettings?.video?.sync_from_easydam || false );
	const [ videoFormat, setVideoFormat ] = useState( mediaSettings?.video?.video_format || 'auto' );
	const [ disableWatermark, setDisableWatermark ] = useState( mediaSettings?.video?.watermark !== undefined ? ! mediaSettings.video.watermark : true );
	const [ adaptiveBitrate, setAdaptiveBitrate ] = useState( mediaSettings?.video?.adaptive_bitrate || true );
	const [ optimizeVideos, setOptimizeVideos ] = useState( mediaSettings?.video?.optimize_videos || false );
	const [ videoQuality, setVideoQuality ] = useState( mediaSettings?.video?.video_quality || [ 'auto' ] );
	const [ videoThumbnails, setVideoThumbnails ] = useState( mediaSettings?.video?.video_thumbnails || 5 );
	const [ overwriteThumbnails, setOverwriteThumbnails ] = useState( mediaSettings?.video?.overwrite_thumbnails || false );
	const [ watermarkText, setWatermarkText ] = useState( mediaSettings?.video?.watermark_text || '' );

	const [ selectedMedia, setSelectedMedia ] = useState( { url: mediaSettings?.video?.watermark_url } );
	const [ useImage, setUseImage ] = useState( mediaSettings?.video?.use_watermark_image || false );

	const [ isModalOpen, setIsModalOpen ] = useState( false );
	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );

	const [ isLicenseKeyLoading, setIsLicenseKeyLoading ] = useState( false ); // Loading indicator for saving license key.
	const [ isDeactivateLoading, setIsDeactivateLoading ] = useState( false );

	const isFirstRender = useRef( true );

	const videoFormatOptions = [
		{ label: 'Not set', value: 'not-set' },
		{ label: 'Auto', value: 'auto' },
	];

	const videoQualityOptions = [
		{ label: 'Auto', value: 'auto' },
		{ label: '240p (352 x 240)', value: '240' },
		{ label: '360p (640 x 360)', value: '360' },
		{ label: '480p (842 x 480)', value: '480' },
		{ label: '720p (1280 x 720)', value: '720' },
		{ label: '1080p (1920 x 1080) (HD)', value: '1080' },
		{ label: '1440p (2560 x 1440) (HD)', value: '1440' },
		{ label: '2160p (3840 x 2160) (4K)', value: '2160' },
	];

	const handleSubmit = ( e ) => {
		e.preventDefault();
	};

	// Function to handle opening the modal
	const handleOpenModal = () => {
		setIsModalOpen( true );
	};

	// Function to handle closing the modal
	const handleCloseModal = () => {
		setIsModalOpen( false );
	};

	useEffect( () => {
		// Trigger verification if the flag is true
		if ( verifyLicenseFromUrl && licenseKey ) {
			saveLicenseKey(); // Use the existing saveLicenseKey function
		}
	}, [ verifyLicenseFromUrl, licenseKey ] );

	const openMediaPicker = () => {
		const fileFrame = wp.media( {
			title: 'Select a Watermark',
			button: {
				text: 'Use this watermark',
			},
			library: {
				type: 'image', // Restrict to images only
			},
			multiple: false, // Disable multiple selection
		} );

		fileFrame.on( 'select', function() {
			const attachment = fileFrame.state().get( 'selection' ).first().toJSON();
			if ( attachment.type === 'image' ) {
				setSelectedMedia( { url: attachment.url } );
			} else {
				// Show a notice for invalid selection
				setNotice( { message: 'Please select a valid image file.', status: 'error', isVisible: true } );
				window.scrollTo( { top: 0, behavior: 'smooth' } );
				setTimeout( () => {
					setNotice( { message: '', status: '', isVisible: false } );
				}, 5000 );
			}
		} );

		fileFrame.open();
	};

	const saveLicenseKey = async () => {
		if ( ! licenseKey.trim() ) {
			setNotice( { message: 'Please enter a valid API key', status: 'error', isVisible: true } );
			return;
		}

		setIsLicenseKeyLoading( true );

		let result = {};

		try {
			const response = await fetch( window.pathJoin( [ restURL, '/godam/v1/settings/verify-license' ] ), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
				body: JSON.stringify( { license_key: licenseKey } ),
			} );

			result = await response.json();

			if ( response.ok ) {
				setNotice( { message: result.message || 'API key verified successfully!', status: 'success', isVisible: true } );
				const updatedSettings = {
					...mediaSettings,
					general: {
						...mediaSettings.general,
						is_verified: true,
					},
				};

				saveMediaSettings( updatedSettings );

				// Reload the page to reflect the changes
				window.location.reload();
			} else {
				setNotice( { message: result.message || 'Failed to verify the API key', status: 'error', isVisible: true } );
				window.userData.valid_license = false;
				window.userData.user_data = {};
			}
		} catch ( error ) {
			setNotice( { message: 'An error occurred. Please try again later', status: 'error', isVisible: true } );
			window.userData.valid_license = false;
			window.userData.user_data = {};
		} finally {
			setIsLicenseKeyLoading( false ); // Hide loading indicator.
		}

		window.scrollTo( { top: 0, behavior: 'smooth' } );

		// Hide the notice after 5 seconds
		setTimeout( () => {
			setNotice( { ...notice, isVisible: false } );
		}, 5000 );
	};

	const deactivateLicenseKey = async () => {
		setIsDeactivateLoading( true );

		try {
			const response = await fetch( window.pathJoin( [ restURL, '/godam/v1/settings/deactivate-license' ] ), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
			} );

			if ( response.ok ) {
				setLicenseKey( '' ); // Clear the license key from state.
				setNotice( { message: 'API key deactivated successfully', status: 'success', isVisible: true } );
				const updatedSettings = {
					...mediaSettings,
					general: {
						...mediaSettings.general,
						is_verified: false,
					},
				};

				saveMediaSettings( updatedSettings );
			} else {
				setNotice( { message: 'Failed to deactivate API key. Please try again', status: 'error', isVisible: true } );
			}
		} catch ( error ) {
			setNotice( { message: 'An error occurred while deactivating the API key', status: 'error', isVisible: true } );
		} finally {
			setIsDeactivateLoading( false );
			// reload the page.
			window.userData.valid_license = false; // Set the flag to true.
			window.userData.user_data = {}; // Set the flag to true.
		}

		window.scrollTo( { top: 0, behavior: 'smooth' } );

		// Hide the notice after 5 seconds
		setTimeout( () => {
			setNotice( { ...notice, isVisible: false } );
		}, 5000 );
	};

	const calculatePercentage = ( used, total ) => {
		if ( total === 0 ) {
			return 0;
		}
		try {
			const result = ( used / total ) * 100;
			return result.toFixed( 2 );
		} catch ( error ) {
			console.error( 'Error calculating percentage:', error );
			return 0;
		}
	};

	const handleSaveSettings = async () => {
		if ( videoQuality.length === 0 ) {
			setNotice( { message: 'Please select at least one video quality', status: 'warning', isVisible: true } );
			window.scrollTo( { top: 0, behavior: 'smooth' } );
			setTimeout( () => {
				setNotice( { message: '', status: '', isVisible: false } );
			}, 5000 );
			return;
		}

		const updatedSettings = {
			...mediaSettings,
			video: {
				sync_from_easydam: syncFromEasyDAM,
				video_format: videoFormat,
				adaptive_bitrate: adaptiveBitrate,
				optimize_videos: optimizeVideos,
				video_quality: videoQuality,
				video_thumbnails: videoThumbnails,
				overwrite_thumbnails: overwriteThumbnails,
				watermark: ! disableWatermark,
				use_watermark_image: useImage,
				watermark_url: selectedMedia?.url || '',
				watermark_text: watermarkText || '',
			},
		};

		const isSaved = await saveMediaSettings( updatedSettings );

		if ( isSaved ) {
			// Success notice
			setNotice( { message: 'Settings saved successfully!', status: 'success', isVisible: true } );
			setIsDirty( false );
		} else {
			// Error notice
			setNotice( { message: 'Failed to save settings. Please try again', status: 'error', isVisible: true } );
		}
		window.scrollTo( { top: 0, behavior: 'smooth' } );
		// Hide the notice after 5 seconds
		setTimeout( () => {
			setNotice( { ...notice, isVisible: false } );
		}, 5000 );
	};

	const isValidAPIKey = window.userData?.valid_license;
	const isStarterPlan = window.userData?.user_data?.active_plan === 'Starter';

	const [ isDirty, setIsDirty ] = useState( false );

	useEffect( () => {
		if ( isFirstRender.current ) {
			// Skip first render
			isFirstRender.current = false;
			return;
		}

		setIsDirty( true );
	}, [ syncFromEasyDAM, videoFormat, disableWatermark, adaptiveBitrate, optimizeVideos, videoQuality, videoThumbnails, overwriteThumbnails, watermarkText, selectedMedia, useImage ] );

	// Warn users before leaving the page if changes are unsaved
	useEffect( () => {
		const handleBeforeUnload = ( event ) => {
			if ( isDirty ) {
				event.preventDefault();
				event.returnValue = 'Changes that you made may not be saved.';
			}
		};

		window.addEventListener( 'beforeunload', handleBeforeUnload );
		return () => {
			window.removeEventListener( 'beforeunload', handleBeforeUnload );
		};
	}, [ isDirty ] );

	return (
		<div>

			{ notice?.isVisible && (
				<Notice
					status={ notice.status }
					onRemove={ () => setNotice( { ...notice, isVisible: false } ) }
					className="mb-2"
				>
					{ notice.message }
				</Notice>
			) }

			{ ! window?.userData?.valid_license && (
				<Panel
					className="mb-4"
				>
					<PanelBody
						opened={ true }
					>
						<h2
							className="text-2xl font-semibold text-center"
						>
							{ __( 'Ensure Smooth Video Playback', 'godam' ) }
						</h2>

						<p
							className="text-center text-gray-600"
						>
							{ __( 'Set up your video transcoding settings to optimize playback across all devices and network conditions. 🚀', 'godam' ) }
						</p>

						<div
							className="w-full flex justify-center items-center mt-4 mb-4"
						>
							<Button
								href="https://godam.io/#pricing"
								target="_blank"
								variant="primary"
							>
								{ __( 'Choose GoDAM plan', 'godam' ) }
							</Button>
						</div>
					</PanelBody>
				</Panel>
			) }

			<Panel
				header={ __( 'API Settings', 'godam' ) }
				className="w-full"
			>
				<PanelBody
					initialOpen={ true }
					className="flex gap-8"
				>
					<div className="flex flex-col gap-2 b-4m">
						<TextControl
							label={ __( 'API Key', 'godam' ) }
							value={ licenseKey }
							onChange={ ( value ) => setLicenseKey( value ) }
							help={
								<>
									{
										( ! window?.userData?.valid_license ) &&
											<>
												{ __( 'Your API key is required to access the features. You can get your active API key from your ', 'godam' ) }
												<a
													href={ GODAM_API_BASE + '/#licenses' }
													target="_blank"
													rel="noopener noreferrer"
													className="text-blue-500 underline"
												>
													{ __( 'Account', 'godam' ) }
												</a>.
											</>
									}
								</>
							}
							placeholder="Enter your API key here"
							className={ `max-w-[400px] ${ ( ! window?.userData?.valid_license && window?.userData?.user_data?.license_key ) ? 'invalid-license-key' : '' }` }
							disabled={ window?.userData?.valid_license }
						/>
						<div className="flex gap-2">
							<Button
								className="max-w-[140px] w-full flex justify-center items-center"
								onClick={ saveLicenseKey }
								disabled={ isLicenseKeyLoading || window?.userData?.valid_license }
								variant="primary"
								isBusy={ isLicenseKeyLoading }
							>
								{ __( 'Save API Key', 'godam' ) }
							</Button>
							<Button
								className="max-w-[160px] w-full flex justify-center items-center"
								onClick={ deactivateLicenseKey }
								disabled={ isLicenseKeyLoading || ! window?.userData?.valid_license }
								variant="secondary"
								isDestructive
								isBusy={ isDeactivateLoading }
							>
								{ __( 'Remove API Key', 'godam' ) }
							</Button>
						</div>
					</div>
					{
						( mediaSettings?.general?.is_verified || window?.userData?.valid_license ) && (
							<div className="flex gap-4 flex-wrap">

								{
									userData.storageBandwidthError ? (
										<p className="text-yellow-700 text-xs h-max">{ userData.storageBandwidthError }</p>
									) : (
										<>
											<div className="flex gap-3 items-center">
												<div className="circle-container">
													<div className="data text-xs">{ calculatePercentage( userData.bandwidth_used, userData.total_bandwidth ) }%</div>
													<div
														className={ `circle ${
															calculatePercentage( userData.bandwidth_used, userData.total_bandwidth ) > 90 ? 'red' : ''
														}` }
														style={ { '--percentage': calculatePercentage( userData.bandwidth_used, userData.total_bandwidth ) + '%' } }
													></div>
												</div>
												<div className="leading-6">
													<div className="easydam-settings-label text-base">{ __( 'BANDWIDTH', 'godam' ) }</div>
													<strong>{ __( 'Available: ', 'godam' ) }</strong>{ parseFloat( userData.total_bandwidth - userData.bandwidth_used ).toFixed( 2 ) }{ __( 'GB', 'godam' ) }
													<br />
													<strong>{ __( 'Used: ', 'godam' ) }</strong>{ parseFloat( userData.bandwidth_used ).toFixed( 2 ) }{ __( 'GB', 'godam' ) }
												</div>
											</div>
											<div className="flex gap-3 items-center">
												<div className="circle-container">
													<div className="data text-xs">{ calculatePercentage( userData.storage_used, userData.total_storage ) }%</div>
													<div
														className={ `circle ${
															calculatePercentage( userData.storage_used, userData.total_storage ) > 90 ? 'red' : ''
														}` }
														style={ { '--percentage': calculatePercentage( userData.storage_used, userData.total_storage ) + '%' } }
													></div>
												</div>
												<div className="leading-6">
													<div className="easydam-settings-label text-base">{ __( 'STORAGE', 'godam' ) }</div>
													<strong>{ __( 'Available: ', 'godam' ) }</strong>{ parseFloat( userData.total_storage - userData.storage_used ).toFixed( 2 ) }{ __( 'GB', 'godam' ) }
													<br />
													<strong>{ __( 'Used: ', 'godam' ) }</strong>{ parseFloat( userData.storage_used ).toFixed( 2 ) }{ __( 'GB', 'godam' ) }
												</div>
											</div>
										</>
									)
								}
							</div>
						)
					}
				</PanelBody>
			</Panel>

			{ window?.userData?.valid_license && ( <>

				<div className="relative mt-4">
					{
						! isValidAPIKey && (
							<div className="premium-feature-overlay">
								<Button icon={ unlock } href="https://app.godam.io/subscription/plans" target="_blank" variant="primary">{ __( 'Unlock with GoDAM pro', 'godam' ) }</Button>
							</div>
						)
					}
					<Panel
						header={ __( 'Video Quality', 'godam' ) }
						className="mb-4"
					>
						<PanelBody
							opened={ true }
						>
							<form id="easydam-video-settings" className="flex flex-col" onSubmit={ handleSubmit }>
								{ /* <div className="py-3 flex flex-col gap-2">
								<label className="block text-base font-semibold" htmlFor="sync_from_easydam">Video delivery</label>
								<ToggleControl
									__nextHasNoMarginBottom
									label="Sync and deliver videos from EasyDAM"
									checked={ syncFromEasyDAM }
									onChange={ ( value ) => setSyncFromEasyDAM( value ) }
								/>
								<div className="text-slate-500">If you turn this setting off, your videos will be delivered from WordPress</div>
							</div>

							*/ }

								{ /* Removing the ABS features toggle */ }
								{ /* <div className="mt-4">
									<label className="easydam-settings-label" htmlFor="abs">{ __( 'Adaptive Bitrate Streaming', 'godam' ) }</label>
									<ToggleControl
										__nextHasNoMarginBottom
										label={ __( 'Enable Adaptive Bitrate Streaming', 'godam' ) }
										help={ __( 'If enabled, GoDAM will generate multiple video files with different bitrates for adaptive streaming', 'godam' ) }
										checked={ adaptiveBitrate }
										onChange={ ( value ) => setAdaptiveBitrate( value ) }
									/>
								</div> */ }

								<div>
									{ /*
								<div className="py-3 flex flex-col gap-1">
									<label className="block text-base font-semibold" htmlFor="optimize_video">Video optimization</label>
									<ToggleControl
										__nextHasNoMarginBottom
										label="Optimize videos on my site"
										checked={ optimizeVideos }
										onChange={ ( value ) => setOptimizeVideos( value ) }
									/>
									<div className="text-slate-500">Videos will be delivered using EasyDAM’s automatic format and quality algorithms for the best tradeoff between visual quality and file size. Use Advanced Optimization options to manually tune format and quality</div>
								</div>

								<div className="flex flex-col gap-1">
									<label className="block text-base font-semibold" htmlFor="video_format">Video format</label>
									<SelectControl
										__next40pxDefaultSize
										__nextHasNoMarginBottom
										value={ videoFormat }
										options={ videoFormatOptions }
										onChange={ ( value ) => setVideoFormat( value ) }
										describedBy="The video format to use for delivery"
										showSelectedHint
										size="compact"
										className="max-w-[400px] w-full"
									/>
									<div className="text-slate-500">The video format to use for delivery. Leave as Auto to automatically deliver the most optimal format based on the user's browser and device</div>
								</div>
								*/ }

									<div>
										<div className="grid grid-rows-4 grid-flow-col gap-2 border rounded p-5">
											{ videoQualityOptions.map( ( option ) => (
												<div key={ option.value } className="py-1 w-fit">
													<CheckboxControl
														label={ option.label }
														checked={ videoQuality.includes( option.value ) || videoQuality.includes( 'auto' ) }
														onChange={ ( isChecked ) => {
															setVideoQuality( ( prev ) => {
																if ( option.value === 'auto' ) {
																// If "Auto" is toggled on, select all options
																	return isChecked ? videoQualityOptions.map( ( opt ) => opt.value ) : prev.filter( ( val ) => val !== 'auto' );
																}
																// Update other options
																const updated = isChecked
																	? [ ...prev, option.value ]
																	: prev.filter( ( val ) => val !== option.value );

																// Automatically toggle "Auto" based on selection of all other options
																const allOthersSelected = videoQualityOptions
																	.filter( ( opt ) => opt.value !== 'auto' ) // Exclude "auto"
																	.every( ( opt ) => updated.includes( opt.value ) );

																// Add "Auto" if all other options are selected, remove otherwise
																return allOthersSelected
																	? [ 'auto', ...updated.filter( ( v ) => v !== 'auto' ) ]
																	: updated.filter( ( v ) => v !== 'auto' );
															} );
														} }
													/>
												</div>
											) ) }
										</div>
										<div className="easydam-settings-help">
											{ __( 'Select one or more video qualities for delivery. GoDAM will generate videos with selected resolutions. Transcoding will be done to the appropriate resolution supported by the video, up to the max resolution of each video.', 'godam' ) }
											<br />
											<strong>{ __( 'Note: ', 'godam' ) }</strong>
											{ __( 'Selecting Auto will automatically include all available resolutions for delivery.', 'godam' ) }
											{ __( ' Quality settings are not available for low-quality videos.', 'godam' ) }
										</div>
									</div>
								</div>

							</form>
						</PanelBody>
					</Panel>
				</div>

				<div className="relative">
					{
						! isValidAPIKey && (
							<div className="premium-feature-overlay">
								<Button icon={ unlock } href="https://app.godam.io/subscription/plans" target="_blank" variant="primary">{ __( 'Unlock with GoDAM pro', 'godam' ) }</Button>
							</div>
						)
					}
					<Panel
						header={ __( 'Video Thumbnails', 'godam' ) }
						className="mb-4"
					>
						<PanelBody
							opened={ true }
						>
							<div>
								<label className="easydam-settings-label" htmlFor="video_thumbnails_count">
									{ __( 'Number of video thumbnails generated', 'godam' ) }
								</label>
								<TextControl
									type="number"
									min="1"
									max="10"
									value={ videoThumbnails }
									onChange={ ( value ) => {
										const parsedValue = parseInt( value, 10 );

										if ( ! isNaN( parsedValue ) ) {
											// Ensure the value is within bounds
											const clampedValue = Math.max( 1, Math.min( 10, parsedValue ) );
											setVideoThumbnails( clampedValue );
										} else {
											setVideoThumbnails( 1 ); // Default to minimum if invalid
										}
									} }
									help={ __( `This field specifies the number of video thumbnails that will be generated by the GoDAM. To choose from the generated thumbnails for a video, go to Media > Edit > Video Thumbnails. Thumbnails are only generated when the video is first uploaded. Please enter a value between 1 and 10`, 'godam' ) }
								/>
							</div>

							<div className="mt-4">
								<label className="easydam-settings-label" htmlFor="overwrite_thumbnails">
									{ __( 'Over-write video thumbnails after retranscoding', 'godam' ) }
								</label>
								<ToggleControl
									__nextHasNoMarginBottom
									label="Over-write video thumbnails"
									checked={ overwriteThumbnails }
									onChange={ ( value ) => setOverwriteThumbnails( value ) }
									help={ __( 'If enabled, GoDAM will replace existing media thumbnails with regenerated ones after retranscoding. If disabled, media thumbnails will remain untouched', 'godam' ) }
								/>
							</div>
						</PanelBody>
					</Panel>
				</div>

				<div className="relative">
					{
						( ! isValidAPIKey || isStarterPlan ) && (
							<div className="premium-feature-overlay">
								<Button icon={ unlock } href="https://app.godam.io/subscription/plans" target="_blank" variant="primary">{ __( 'Upgrade to unlock', 'godam' ) }</Button>
							</div>
						)
					}
					<Panel
						header={ __( 'Video watermark', 'godam' ) }
						className="mb-4"
					>
						<PanelBody
							opened={ true }
						>

							<div className="py-3 flex flex-col gap-2 opacity-90 relative">
								{ /* <label className="easydam-settings-label" htmlFor="abs">{ __( 'Watermark', 'godam' ) }</label> */ }
								<ToggleControl
									__nextHasNoMarginBottom
									label="Disable video watermark"
									checked={ ( ! isValidAPIKey || isStarterPlan ) ? false : disableWatermark }
									onChange={ ( value ) => setDisableWatermark( value ) }
									disabled={ isStarterPlan || ! isValidAPIKey }
									help={ __( 'If enabled, GoDAM will add a watermark to the transcoded video', 'godam' ) }
								/>
								{ ! isStarterPlan && ! disableWatermark && (
									<>
										<div>
											<ToggleControl
												label={ __( 'Use image watermark', 'godam' ) }
												checked={ useImage }
												onChange={ ( value ) => {
													setUseImage( value );
												} }
												help={
													<>
														{ __( 'If enabled, Transcoder will use an image instead of text as the watermark for the transcoded video', 'godam' ) }
														<strong className="font-semibold">{ __( '(Recommended dimensions: 200 px width × 70 px height)', 'godam' ) }</strong>
													</>
												}
											/>

											{ useImage && (
												<div className="mt-2">
													<div className="flex gap-2">
														<Button variant="primary" onClick={ openMediaPicker }>
															{ selectedMedia && selectedMedia.url ? 'Change Watermark' : 'Select Watermark' }
														</Button>
														{ selectedMedia && selectedMedia.url && (
															<Button
																isDestructive
																onClick={ () => setSelectedMedia( null ) }
																variant="secondary"
															>
																{ __( 'Remove Watermark', 'godam' ) }
															</Button>
														) }
													</div>
													{ selectedMedia && selectedMedia.url && (
														<div className="mt-2 border-2 border-blue-700 rounded-lg p-2 inline-block bg-gray-200">
															<img
																src={ selectedMedia.url }
																alt={ selectedMedia.alt || 'Selected watermark' }
																className="max-w-[200px]"
															/>
														</div>
													) }
												</div>
											) }
										</div>
										{ ! useImage && (
											<div>
												<label className="easydam-settings-label" htmlFor="watermark_text">{ __( 'Watermark Text', 'godam' ) }</label>
												<TextControl
													__next40pxDefaultSize
													__nextHasNoMarginBottom
													value={ watermarkText }
													onChange={ ( value ) => setWatermarkText( value ) }
													placeholder="Enter watermark text"
													className="max-w-[400px]"
													help={ __( 'Specify the watermark text that will be added to transcoded videos', 'godam' ) }
												/>
											</div>
										) }
									</>
								) }
							</div>
							{ isModalOpen && (
								<Modal
									title="Upgrade to Premium"
									onRequestClose={ handleCloseModal }
								>
									<p className="text-base text-gray-700">
										{ __( 'To access this feature, please upgrade to our premium subscription plan', 'godam' ) }
									</p>
									<Button
										isPrimary
										className="mt-4"
									>
										{ __( 'Go to Payment Page', 'godam' ) }
									</Button>
								</Modal>
							) }
						</PanelBody>
					</Panel>
				</div>

				<Button
					variant="primary"
					className="mt-4 max-w-[140px] w-full flex justify-center items-center"
					onClick={ handleSaveSettings }
				>
					{ __( 'Save Settings', 'godam' ) }
				</Button>

			</> ) }

		</div>
	);
};

export default VideoSettings;
