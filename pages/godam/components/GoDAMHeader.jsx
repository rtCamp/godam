/**
 * WordPress dependencies
 */
import { help, trendingUp, download } from '@wordpress/icons';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import godamLogo from '../../../assets/src/images/godam-logo.png';

const GodamHeader = () => {
	const helpLink = window.godamRestRoute?.apiBase + '/helpdesk';
	const upgradePlanLink = window.godamRestRoute?.apiBase + '/subscription/plans';
	const pricingLink = `https://godam.io/pricing?utm_campaign=buy-plan&utm_source=${ window?.location?.host || '' }&utm_medium=plugin&utm_content=header`;
	const godamMediaLink = window.godamRestRoute?.apiBase + '/web/media-library';

	return (
		<header>
			<div className="godam-settings-header border-b -ml-[32px] pl-[32px] bg-white">
				<div className="godam-settings-header-content max-w-[1440px] mx-auto pl-4 pr-6 flex items-center justify-between">
					<div className="py-6 m-0 text-4xl leading-4 font-semibold text-slate-900 flex items-end">
						<img className="h-8 sm:h-9 md:h-12" src={ godamLogo } alt={ __( 'GoDAM Logo', 'godam' ) } />
						<div className="ml-3">
							<div className="text-xs font-normal leading-4">{ `v${ window?.pluginInfo?.version }` }</div>
							{
								window?.userData?.userApiData?.active_plan &&
								<div className="text-xs font-bold py-[2px] px-2 rounded bg-indigo-100 mt-1">{ window?.userData?.userApiData?.active_plan }</div>
							}
						</div>
					</div>
					<div className="flex items-center gap-2 sm:gap-3">
						<Button
							variant="tertiary"
							href={ helpLink }
							target="_blank"
							className="rounded-full godam-button-icon"
							label={ __( 'Need help?', 'godam' ) }
							icon={ help }
						/>
						<div className="flex flex-col sm:flex-row md:items-center gap-1 sm:gap-2 md:gap-3">
							<Button
								className={ `godam-button text-xs md:text-sm ${ ( ! window?.userData?.validApiKey || ! window?.userData?.userApiData?.active_plan ) ? 'disabled' : '' }` }
								variant="primary"
								size="compact"
								target={ ( window?.userData?.validApiKey && window?.userData?.userApiData?.active_plan ) ? '_blank' : undefined }
								text={ __( 'Manage Media', 'godam' ) }
								href={ ( window?.userData?.validApiKey && window?.userData?.userApiData?.active_plan ) ? godamMediaLink : '#' }
								icon={
									<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none">
										<path d="M25.5578 20.0911L8.05587 37.593L3.46397 33.0011C0.818521 30.3556 2.0821 25.8336 5.72228 24.9464L25.5632 20.0964L25.5578 20.0911Z" fill="white" />
										<path d="M47.3773 21.8867L45.5438 29.3875L22.6972 52.2341L11.2605 40.7974L34.1662 17.8916L41.5703 16.0796C45.0706 15.2247 48.2323 18.3863 47.372 21.8813L47.3773 21.8867Z" fill="white" />
										<path d="M43.5059 38.1036L38.6667 57.8907C37.7741 61.5255 33.2521 62.7891 30.6066 60.1436L26.0363 55.5732L43.5059 38.1036Z" fill="white" />
									</svg>
								}
								iconSize={ 16 }
								showTooltip={ true }
								tooltipPosition="bottom center"
								label={ ( ! window?.userData?.validApiKey || ! window?.userData?.userApiData?.active_plan ) ? __( 'Premium feature', 'godam' ) : __( 'GoDAM Central', 'godam' ) }
								// disabled={ ! window?.userData?.validApiKey || ! window?.userData?.userApiData?.active_plan }
							/>

							{
								( window?.userData?.validApiKey && window?.userData?.userApiData?.active_plan && ( window?.userData?.userApiData?.active_plan )?.toLowerCase() !== 'platinum' ) && (
									<Button
										className="godam-button text-xs md:text-sm"
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
								( ! window?.userData?.validApiKey || ! window?.userData?.userApiData?.active_plan ) && (
									<Button
										className="godam-button text-xs md:text-sm"
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
