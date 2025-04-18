/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import godamLogo from '../../assets/src/images/godam-logo.png';
import { help } from '@wordpress/icons';

const GodamHeader = () => {
	const helpLink = 'http://app.godam.io/helpdesk';
	const upgradePlanLink = 'https://app.godam.io/subscription/plans';
	const pricingLink = 'https://godam.io#pricing';

	return (
		<header>
			<div className="easydam-settings-header border-b -ml-[32px] pl-[32px]">
				<div className="max-w-[1260px] mx-auto pl-4 pr-9 flex items-center justify-between">
					<h1 className="py-6 m-0 text-4xl leading-4 font-semibold text-slate-900 flex items-end">
						<img className="h-12" src={ godamLogo } alt="GoDAM" />
						<div className="ml-3">
							<div className="text-xs font-normal leading-4">{ `v${ window?.pluginInfo?.version }` }</div>
							{
								window?.userData?.user_data?.active_plan &&
								<div className="text-xs font-bold py-[2px] px-2 rounded bg-indigo-100 mt-1">{ window?.userData?.user_data?.active_plan }</div>
							}
						</div>
					</h1>
					<div className="flex items-center">
						<Button
							variant="tertiary"
							href={ helpLink }
							target="_blank"
							className="rounded-full"
							label={ __( 'Need help?', 'godam' ) }
							icon={ help }
						/>
						{
							( window?.userData?.valid_api_key && window?.userData?.user_data?.active_plan && ( window?.userData?.user_data?.active_plan )?.toLowerCase() !== 'platinum' ) &&
								<Button
									className="ml-2"
									variant="primary"
									size="compact"
									href={ upgradePlanLink }
									target="_blank"
									text={ __( 'Upgrade plan', 'godam' ) }
								/>
						}
						{
							( ! window?.userData?.valid_api_key || ! window?.userData?.user_data?.active_plan ) &&
							<Button
								className="ml-2"
								variant="primary"
								size="compact"
								href={ pricingLink }
								target="_blank"
								text={ __( 'Get GoDAM', 'godam' ) }
							/>
						}
					</div>
				</div>
			</div>
		</header>
	);
};

export default GodamHeader;
