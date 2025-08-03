/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useState } from 'react';

/**
 * Internal dependencies
 */
import godamLogo from '../../../assets/src/images/godam-logo.png';
import { help, menu, close } from '@wordpress/icons';

const GodamHeader = () => {
	const [ isMobileMenuOpen, setIsMobileMenuOpen ] = useState( false );
	const helpLink = window.godamRestRoute?.apiBase + '/helpdesk';
	const upgradePlanLink = window.godamRestRoute?.apiBase + '/subscription/plans';
	const pricingLink = `https://godam.io/pricing?utm_campaign=buy-plan&utm_source=${ window?.location?.host || '' }&utm_medium=plugin&utm_content=header`;
	const godamMediaLink = window.godamRestRoute?.apiBase + '/web/media-library';

	const manageMediaButton = (
		<Button
			className={ `godam-button ${ ( ! window?.userData?.validApiKey || ! window?.userData?.userApiData?.active_plan ) ? 'disabled' : '' }` }
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
			label={ ( ! window?.userData?.valid_api_key || ! window?.userData?.user_data?.active_plan ) ? __( 'Premium feature', 'godam' ) : __( 'GoDAM Central', 'godam' ) }
			tooltipText={ __( 'Manage Media', 'godam' ) }
		/>
	);

	const upgradeButton = (
		( window?.userData?.validApiKey && window?.userData?.userApiData?.active_plan && ( window?.userData?.userApiData?.active_plan )?.toLowerCase() !== 'platinum' ) &&
		<Button
			className="godam-button"
			variant="primary"
			size="compact"
			href={ upgradePlanLink }
			target="_blank"
			text={ __( 'Upgrade plan', 'godam' ) }
		/>
	);

	const getGodamButton = (
		( ! window?.userData?.validApiKey || ! window?.userData?.userApiData?.active_plan ) &&
			<Button
				className="godam-button"
				variant="primary"
				size="compact"
				href={ pricingLink }
				target="_blank"
				text={ __( 'Get GoDAM', 'godam' ) }
			/>
	);

	return (
		<header>
			<div className="easydam-settings-header border-b -ml-[32px] pl-[32px] bg-white">
				<div className="max-w-[1440px] mx-auto pl-4 pr-9 flex items-center justify-between">
					{ /* Logo and Version Info */ }
					<h1 className="py-6 m-0 text-4xl leading-4 font-semibold text-slate-900 flex items-end">
						<img className="h-12" src={ godamLogo } alt="GoDAM" />
						<div className="ml-3">
							<div className="text-xs font-normal leading-4">{ `v${ window?.pluginInfo?.version }` }</div>
							{
								window?.userData?.userApiData?.active_plan &&
								<div className="text-xs font-bold py-[2px] px-2 rounded bg-indigo-100 mt-1">{ window?.userData?.userApiData?.active_plan }</div>
							}
						</div>
					</h1>

					{ /* Desktop Buttons - Hidden on small screens */ }
					<div className="hidden lg:flex items-center space-x-2">
						<Button
							variant="tertiary"
							href={ helpLink }
							target="_blank"
							className="rounded-full godam-button-icon"
							label={ __( 'Need help?', 'godam' ) }
							icon={ help }
						/>
						{ manageMediaButton }
						{ upgradeButton }
						{ getGodamButton }
					</div>

					{ /* Mobile Menu Button - Hidden on large screens */ }
					<div className="lg:hidden">
						<Button
							onClick={ () => setIsMobileMenuOpen( ! isMobileMenuOpen ) }
							icon={ isMobileMenuOpen ? close : menu }
							label={ isMobileMenu-Open ? __( 'Close menu', 'godam' ) : __( 'Open menu', 'godam' ) }
						/>
					</div>
				</div>

				{ /* Mobile Menu Panel - Toggled by the mobile menu button */ }
				{ isMobileMenuOpen && (
					<div className="lg:hidden border-t">
						<div className="p-4 flex flex-col items-start space-y-3">
							{ manageMediaButton }
							{ upgradeButton }
							{ getGodamButton }
							<Button
								href={ helpLink }
								target="_blank"
								icon={ help }
								className="godam-button"
							>
								{ __( 'Need help?', 'godam' ) }
							</Button>
						</div>
					</div>
				) }
			</div>
		</header>
	);
};

export default GodamHeader;