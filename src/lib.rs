use std::{env, fs};
use zed_extension_api::{self as zed, Result};

/// ビルド済みLSPサーバーをバイナリに埋め込む
const SERVER_JS: &[u8] = include_bytes!("../lsp/dist/server.js");

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
        // ワーキングディレクトリにサーバースクリプトを書き出す
        let server_file = "server.js";
        fs::write(server_file, SERVER_JS)
            .map_err(|e| format!("LSPサーバーの書き出しに失敗: {e}"))?;

        let server_path = env::current_dir()
            .unwrap()
            .join(server_file)
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
