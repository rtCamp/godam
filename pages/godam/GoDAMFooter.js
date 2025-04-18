/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Icon, Tooltip } from '@wordpress/components';

const GoDAMFooter = () => {
	const DOCS_LINKS = [
		{
			title: __( 'Support', 'godam' ),
			url: 'http://app.godam.io/helpdesk/my-tickets',
		},
		{
			title: __( 'DocS', 'godam' ),
			url: 'https://godam.io/docs/overview',
		},
		{
			title: __( 'Newsletter', 'godam' ),
			url: 'https://godam.io/newsletter',
		},
	];

	const SOCIAL_ICONS = [
		{
			title: __( 'Twitter X', 'godam' ),
			url: 'https://x.com/godam_io',
			icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-twitter-x" viewBox="0 0 16 16">
				<path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865z" />
			</svg>,
		},
		{
			title: __( 'Linkedin', 'godam' ),
			url: 'https://www.linkedin.com/company/godamio',
			icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-linkedin" viewBox="0 0 16 16">
				<path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854zm4.943 12.248V6.169H2.542v7.225zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248S2.4 3.226 2.4 3.934c0 .694.521 1.248 1.327 1.248zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016l.016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225z" />
			</svg>,
		},
		{
			title: __( 'Instagram', 'godam' ),
			url: 'https://www.instagram.com/godam.io',
			icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-instagram" viewBox="0 0 16 16">
				<path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.9 3.9 0 0 0-1.417.923A3.9 3.9 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.9 3.9 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.9 3.9 0 0 0-.923-1.417A3.9 3.9 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599s.453.546.598.92c.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.5 2.5 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.5 2.5 0 0 1-.92-.598 2.5 2.5 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233s.008-2.388.046-3.231c.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92s.546-.453.92-.598c.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92m-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217m0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334" />
			</svg>,
		},
		{
			title: __( 'Youtube', 'godam' ),
			url: 'https://www.youtube.com/@TeamGoDAM',
			icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-youtube" viewBox="0 0 16 16">
				<path d="M8.051 1.999h.089c.822.003 4.987.033 6.11.335a2.01 2.01 0 0 1 1.415 1.42c.101.38.172.883.22 1.402l.01.104.022.26.008.104c.065.914.073 1.77.074 1.957v.075c-.001.194-.01 1.108-.082 2.06l-.008.105-.009.104c-.05.572-.124 1.14-.235 1.558a2.01 2.01 0 0 1-1.415 1.42c-1.16.312-5.569.334-6.18.335h-.142c-.309 0-1.587-.006-2.927-.052l-.17-.006-.087-.004-.171-.007-.171-.007c-1.11-.049-2.167-.128-2.654-.26a2.01 2.01 0 0 1-1.415-1.419c-.111-.417-.185-.986-.235-1.558L.09 9.82l-.008-.104A31 31 0 0 1 0 7.68v-.123c.002-.215.01-.958.064-1.778l.007-.103.003-.052.008-.104.022-.26.01-.104c.048-.519.119-1.023.22-1.402a2.01 2.01 0 0 1 1.415-1.42c.487-.13 1.544-.21 2.654-.26l.17-.007.172-.006.086-.003.171-.007A100 100 0 0 1 7.858 2zM6.4 5.209v4.818l4.157-2.408z" />
			</svg>,
		},
		{
			title: __( 'WordPress.org', 'godam' ),
			url: 'https://wordpress.org/support/plugin/godam/reviews/?filter=5#new-post',
			icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-wordpress" viewBox="0 0 16 16">
				<path d="M12.633 7.653c0-.848-.305-1.435-.566-1.892l-.08-.13c-.317-.51-.594-.958-.594-1.48 0-.63.478-1.218 1.152-1.218q.03 0 .058.003l.031.003A6.84 6.84 0 0 0 8 1.137 6.86 6.86 0 0 0 2.266 4.23c.16.005.313.009.442.009.717 0 1.828-.087 1.828-.087.37-.022.414.521.044.565 0 0-.371.044-.785.065l2.5 7.434 1.5-4.506-1.07-2.929c-.369-.022-.719-.065-.719-.065-.37-.022-.326-.588.043-.566 0 0 1.134.087 1.808.087.718 0 1.83-.087 1.83-.087.37-.022.413.522.043.566 0 0-.372.043-.785.065l2.48 7.377.684-2.287.054-.173c.27-.86.469-1.495.469-2.046zM1.137 8a6.86 6.86 0 0 0 3.868 6.176L1.73 5.206A6.8 6.8 0 0 0 1.137 8" />
				<path d="M6.061 14.583 8.121 8.6l2.109 5.78q.02.05.049.094a6.85 6.85 0 0 1-4.218.109m7.96-9.876q.046.328.047.706c0 .696-.13 1.479-.522 2.458l-2.096 6.06a6.86 6.86 0 0 0 2.572-9.224z" />
				<path fillRule="evenodd" d="M0 8c0-4.411 3.589-8 8-8s8 3.589 8 8-3.59 8-8 8-8-3.589-8-8m.367 0c0 4.209 3.424 7.633 7.633 7.633S15.632 12.209 15.632 8C15.632 3.79 12.208.367 8 .367 3.79.367.367 3.79.367 8" />
			</svg>,
			tooltip: __( 'Rate us on WordPress.org', 'godam' ),
		},
	];

	return (
		<footer className="godam-footer">
			<div className="-ml-[32px] pl-[32px]">
				<div className="max-w-[1260px] mx-auto pl-4 pr-9 flex items-center justify-center">
					<div>
						<p className="text-center font-semibold">{ __( 'Made with ♥ by the GoDAM Team', 'godam' ) }</p>
						<ul className="godam-footer__links">
							{
								DOCS_LINKS.map( ( link, index ) => (
									<li key={ index } className="godam-footer__links__item">
										<a href={ link.url } target="_blank" rel="noreferrer">{ link.title }</a>
									</li>
								) )
							}
						</ul>
						<ul className="godam-footer__social-links">
							{
								SOCIAL_ICONS.map( ( icon, index ) => (
									<li key={ index } className="godam-footer__social-links__item">
										<Tooltip
											text={ icon.tooltip }
											placement="bottom"
										>
											<a href={ icon.url } target="_blank" rel="noreferrer">
												<Icon
													icon={ icon.icon }
													className="godam-footer__social-icon"
												/>
											</a>
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
