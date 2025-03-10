/**
 * WordPress dependencies
 */
import { Button, Panel, PanelBody } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { useGetSubscriptionPlansQuery } from '../../redux/api/media-settings';

const GODAM_API_BASE = 'https://godam.io';

const PricingPlan = () => {
	const { data: plans, isSuccess } = useGetSubscriptionPlansQuery();

	// If the request is still loading, return null
	if ( ! isSuccess ) {
		return null;
	}

	return (
		<Panel
			header={ __( 'Pricing Plan', 'godam' ) }
			className="godam-panel"
		>
			<PanelBody
				opened={ true }
			>
				<div className="subscription-plans max-w-full">

					<p className="mb-6 mt-0 text-base">
						{ __( 'To enable transcoding, you will need to subscribe to one of the following plans after downloading GoDAM. We encourage you to explore the service with the free subscription plan.', 'godam' ) }
						<a href="https://godam.io/#pricing">{ __( 'See all the available features', 'godam' ) }</a>
					</p>

					<div className="flex gap-4 flex-wrap justify-center pb-4 max-w-full">
						{ plans?.data?.map( ( plan ) => (
							<div
								key={ plan.name }
								className="plan flex-shrink-0 border px-6 py-5 rounded-xl shadow-sm bg-white transition-transform transform hover:shadow-lg flex flex-col justify-center items-center gap-2"
							>
								<div className="text-center">
									<h3 className="text-lg font-bold text-gray-800 mb-0">{ plan.name } { __( 'Plan', 'godam' ) }</h3>
								</div>
								<p className="text-base font-semibold text-gray-800 my-1 text-center">
									${ plan.cost } <span className="text-base text-gray-500">{ __( 'Per', 'godam' ) } { plan.billing_interval }</span>
								</p>
								<ul className="text-base text-gray-600 my-2 text-center">
									<li>{ plan.bandwidth }{ __( 'GB bandwidth', 'godam' ) }</li>
									<li>{ plan.storage }{ __( 'GB storage', 'godam' ) }</li>
									<li>{ __( 'High-quality transcoding', 'godam' ) }</li>
									<li>{ __( 'Access to advanced analytics', 'godam' ) }</li>
								</ul>
								<Button
									className="godam-button w-full justify-center"
									variant="primary"
									href={ `${ GODAM_API_BASE }/subscription/account-creation?plan_name=${ encodeURIComponent( plan.name ) }&ref=${ encodeURIComponent( window.location.href ) }` }
									target="_blank"
									rel="noopener noreferrer"
								>
									{ __( 'Subscribe', 'godam' ) }
								</Button>
								<Button
									className="godam-button w-full justify-center"
									variant="secondary"
									href={ `${ GODAM_API_BASE }/subscription/account-creation?plan_name=${ encodeURIComponent( plan.name ) }&ref=${ encodeURIComponent( window.location.href ) }&billing=trial` }
									target="_blank"
									rel="noopener noreferrer"
								>
									{ __( 'Start 7 Days Free Trial', 'godam' ) }
								</Button>
							</div>
						) ) }
					</div>
				</div>
			</PanelBody>
		</Panel>
	);
};

export default PricingPlan;
