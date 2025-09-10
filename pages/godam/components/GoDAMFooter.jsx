/**
 * External dependencies
 */
import { TwitterX, Linkedin, Instagram, Youtube, Wordpress, Facebook } from 'react-bootstrap-icons';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Tooltip } from '@wordpress/components';

/**
 * Internal dependencies
 */
import './godam-footer.scss';

const DOCS_LINKS = [
	{
		title: __( 'Support', 'godam' ),
		url: 'http://app.godam.io/helpdesk/my-tickets',
	},
	{
		title: __( 'Docs', 'godam' ),
		url: 'https://godam.io/docs/overview',
	},
	{
		title: __( 'Newsletter', 'godam' ),
		url: 'https://godam.io/newsletter',
	},
	{
		title: __( 'What\'s New', 'godam' ),
		url: `${ window.footerData?.adminUrl }?page=rtgodam_whats_new`,
		target: '_self',
	},
];

const SOCIAL_ICONS = [
	{
		title: __( 'Twitter X', 'godam' ),
		url: 'https://x.com/godam_io',
		icon: <TwitterX />,
	},
	{
		title: __( 'Facebook', 'godam' ),
		url: 'https://www.facebook.com/Godam.io',
		icon: <Facebook />,
	},
	{
		title: __( 'Linkedin', 'godam' ),
		url: 'https://www.linkedin.com/company/godamio',
		icon: <Linkedin />,
	},
	{
		title: __( 'Instagram', 'godam' ),
		url: 'https://www.instagram.com/godam_io',
		icon: <Instagram />,
	},
	{
		title: __( 'Youtube', 'godam' ),
		url: 'https://www.youtube.com/@godam_io',
		icon: <Youtube />,
	},
	{
		title: __( 'WordPress.org', 'godam' ),
		url: 'https://wordpress.org/support/plugin/godam/reviews/?filter=5#new-post',
		icon: <Wordpress />,
		tooltip: __( 'Rate us on WordPress.org', 'godam' ),
	},
];

const GoDAMFooter = () => {
	return (
		<footer className="godam-footer" data-testid="godam-footer">
			<div className="-ml-[32px] pl-[32px]" data-testid="godam-footer-content">
				<div className="max-w-[1260px] mx-auto pl-4 pr-9 flex items-center justify-center" data-testid="godam-footer-wrapper">
					<div data-testid="godam-footer-info">
						<p className="text-center font-semibold" data-testid="godam-footer-text">{ __( 'Made with ♥ by the GoDAM Team', 'godam' ) }</p>
						<ul className="godam-footer__links" data-testid="godam-footer-links">
							{
								DOCS_LINKS.map( ( link, index ) => (
									<li key={ index } className="godam-footer__links__item" data-testid={ `godam-footer-link-${ index }` }>
										<a href={ link.url } target={ link.target || '_blank' } rel="noreferrer" data-testid={ `godam-footer-link-${ link.title.toLowerCase().replace( /\s+/g, '-' ) }` }>{ link.title }</a>
									</li>
								) )
							}
						</ul>
						<ul className="godam-footer__social-links" data-testid="godam-footer-social-links">
							{
								SOCIAL_ICONS.map( ( icon, index ) => (
									<li key={ index } className="godam-footer__social-links__item" data-testid={ `godam-footer-social-${ index }` }>
										<Tooltip
											text={ icon.tooltip }
											placement="bottom"
										>
											<a href={ icon.url } target="_blank" rel="noreferrer" aria-label={ icon.title } data-testid={ `godam-footer-social-${ icon.title.toLowerCase().replace( /\s+/g, '-' ) }` }>{ icon.icon }</a>
										</Tooltip>
									</li>
								) )
							}
						</ul>
					</div>
				</div>
			</div>
		</footer>
	);
};

export default GoDAMFooter;
