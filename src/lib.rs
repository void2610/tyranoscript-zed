use std::env;
use zed_extension_api::{self as zed, Result};

/// 拡張ディレクトリ内のLSPサーバースクリプトのパス
const SERVER_PATH: &str = "lsp/dist/server.js";

struct TyranoScriptExtension;

impl zed::Extension for TyranoScriptExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &zed::LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        // Zed組み込みのNode.jsバイナリを使用してLSPサーバーを起動
        let server_path = env::current_dir()
            .unwrap()
            .join(SERVER_PATH)
            .to_string_lossy()
            .to_string();

        Ok(zed::Command {
            command: zed::node_binary_path()?,
            args: vec![server_path, "--stdio".to_string()],
            env: Default::default(),
        })
    }
}

zed::register_extension!(TyranoScriptExtension);
