function setup_wordpress_files() {
  # Since it is a plugin deployment, iirc we skip this step
  cd "$GITHUB_WORKSPACE"
  build_root="$(pwd)"
  export build_root
}

function main() {
    setup_hosts_file
		check_branch_in_hosts_file
		setup_ssh_access
		maybe_install_node_dep
		maybe_run_node_build
		maybe_install_submodules
		setup_wordpress_files
		block_emails
		deploy
}

main