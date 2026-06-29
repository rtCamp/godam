/**
 * WordPress dependencies
 */
import { help, trendingUp, download } from '@wordpress/icons';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import godamLogo from '../../../assets/src/images/godam-logo.svg';
import { hasAPIKey } from '../utils/index.js';
import './GoDAMHeader.scss';

const GodamHeader = () => {
	const isVideoEditorPage = window.location.href.includes( 'page=rtgodam_video_editor' );
	const isAnalyticsPage = window.location.href.includes( 'page=rtgodam_analytics' );
	const helpLink = window.godamRestRoute?.apiBase + '/helpdesk';
	const upgradePlanLink = window.godamRestRoute?.apiBase + '/web/billing?tab=Plans';
	const pricingLink = `https://godam.io/pricing?utm_campaign=buy-plan&utm_source=${ window?.location?.host || '' }&utm_medium=plugin&utm_content=header`;
	const godamMediaLink = window.godamRestRoute?.apiBase + '/web/media-library';
	const [ mediaLink, setMediaLink ] = useState( godamMediaLink );

	let paddingClass = 'px-4';

	if ( isAnalyticsPage ) {
		paddingClass = 'px-10';
	} else if ( isVideoEditorPage ) {
		paddingClass = 'px-6';
	}

	useEffect( () => {
		// Only fetch site data if there's a valid API key
		if ( ! window?.userData?.validApiKey ) {
			return;
		}

		const fetchMediaLink = async () => {
			try {
				// Use apiFetch with full URL to handle multisite properly
				const restUrl = window.godamRestRoute?.url || window.wpApiSettings?.root || '/wp-json/';
				const siteDataUrl = `${ restUrl }godam/v1/site/site-data`;

				const response = await apiFetch( {
					url: siteDataUrl,
					method: 'GET',
					headers: {
						'X-WP-Nonce': window.wpApiSettings.nonce,
					},
				} );
				if ( 'success' === response?.status && response?.data?.message?.folder_id ) {
					const mediaUrl = `${ godamMediaLink }?page=1&viewMode=grid&tab=Folder&folder=${ response.data.message.folder_id }`;
					setMediaLink( mediaUrl );
				}
			} catch ( error ) {
				throw new Error( 'Error fetching media link:', error );
			}
		};

		fetchMediaLink();
	}, [ godamMediaLink ] );

	return (
		<header className="sticky top-0 z-[999]">
			<div className="godam-settings-header border-b -ml-[32px] pl-[32px] bg-white">
				<div className={ `godam-settings-header-content max-w-[1440px] mx-auto ${ paddingClass } flex items-center justify-between` }>
					<div className="godam-settings-header-brand m-0 leading-none font-semibold text-slate-900 flex items-center max-[410px]:flex-col max-[410px]:items-start max-[410px]:gap-1 gap-2">
						<div className="flex items-end gap-1">
							<img className="h-5 sm:h-6 md:h-7" src={ godamLogo } alt={ __( 'GoDAM Logo', 'godam' ) } />
							<div className="text-xs font-normal leading-4 pb-1 godam-version-label">{ `v${ window?.pluginInfo?.version }` }</div>
						</div>
						<div>
							<div className="text-xs font-normal leading-4 max-[410px]:hidden">{ `v${ window?.pluginInfo?.version }` }</div>
							{
								window?.userData?.userApiData?.active_plan &&
								<div className="text-center md:text-left text-xs font-bold py-[2px] px-2 rounded bg-indigo-100 mt-1">{ window?.userData?.userApiData?.active_plan }</div>
							}
						</div>
					</div>
					<div className="godam-settings-header-actions flex items-center gap-2 sm:gap-3 md:gap-4">
						<div className="flex flex-col sm:flex-row md:items-center gap-1 sm:gap-2 md:gap-3">
							<Button
								variant="tertiary"
								href={ helpLink }
								target="_blank"
								className="rounded-full godam-button-icon sm:h-10 sm:w-10 [&>svg]:sm:w-7 [&>svg]:sm:h-7"
								label={ __( 'Need help?', 'godam' ) }
								icon={ help }
							/>
						</div>
						<div className="flex flex-col sm:flex-row md:items-center gap-1 sm:gap-2 md:gap-3">
							<Button
								className={ `${ ( ! window?.userData?.validApiKey || ! window?.userData?.userApiData?.active_plan ) ? 'disabled' : '' }` }
								variant="tertiary"
								size="compact"
								target={ ( window?.userData?.validApiKey && window?.userData?.userApiData?.active_plan ) ? '_blank' : undefined }
								text={ __( 'Manage Media', 'godam' ) }
								href={ ( window?.userData?.validApiKey && window?.userData?.userApiData?.active_plan ) ? mediaLink : '#' }
								iconSize={ 16 }
								showTooltip={ true }
								tooltipPosition="bottom center"
								label={ ( ! window?.userData?.validApiKey || ! window?.userData?.userApiData?.active_plan ) ? __( 'Premium feature', 'godam' ) : __( 'GoDAM Central', 'godam' ) }
							/>

							{
								( window?.userData?.validApiKey && window?.userData?.userApiData?.active_plan && ( window?.userData?.userApiData?.active_plan )?.toLowerCase() !== 'platinum' ) && (
									<Button
										variant="primary"
										size="compact"
										href={ upgradePlanLink }
										target="_blank"
										icon={ trendingUp }
										iconSize={ 16 }
										text={ __( 'Upgrade plan', 'godam' ) }
									/>
								) }
							{
								( ! hasAPIKey ) && (
									<Button
										variant="primary"
										size="compact"
										href={ pricingLink }
										target="_blank"
										icon={ download }
										iconSize={ 16 }
										text={ __( 'Get GoDAM', 'godam' ) }
									/>
								) }
						</div>
					</div>
				</div>
			</div>
		</header>
	);
};

export default GodamHeader;
