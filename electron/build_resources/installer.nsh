; installer.nsh — Hook NSIS injetado pelo electron-builder
; Detecta Ollama e oferece instalar antes do Tusab terminar de instalar.
; Suporte a 3 idiomas: Português (1046), Inglês (1033), Espanhol (3082).
; electron-builder injeta este arquivo automaticamente se estiver em build_resources/

; ── Strings localizadas ────────────────────────────────────────────────────────

; Pergunta principal: Ollama não encontrado, quer baixar?
LangString OLLAMA_ASK 1046 "O Tusab usa o Ollama para rodar IA direto no seu computador.$\n$\nO Ollama nao foi detectado. Deseja baixar e instalar agora? (~50 MB)$\n$\nVoce pode pular esta etapa e instalar o Ollama depois em ollama.com"
LangString OLLAMA_ASK 1033 "Tusab uses Ollama to run AI directly on your computer.$\n$\nOllama was not detected. Would you like to download and install it now? (~50 MB)$\n$\nYou can skip this step and install Ollama later at ollama.com"
LangString OLLAMA_ASK 3082 "Tusab usa Ollama para ejecutar IA directamente en tu computadora.$\n$\nNo se detecto Ollama. Deseas descargarlo e instalarlo ahora? (~50 MB)$\n$\nPuedes omitir este paso e instalar Ollama despues en ollama.com"

; Caption da janela de download
LangString OLLAMA_DL_CAPTION 1046 "Baixando Ollama"
LangString OLLAMA_DL_CAPTION 1033 "Downloading Ollama"
LangString OLLAMA_DL_CAPTION 3082 "Descargando Ollama"

; Banner da janela de download
LangString OLLAMA_DL_BANNER 1046 "Aguarde enquanto o Ollama e baixado..."
LangString OLLAMA_DL_BANNER 1033 "Please wait while Ollama is being downloaded..."
LangString OLLAMA_DL_BANNER 3082 "Espera mientras se descarga Ollama..."

; DetailPrint: baixando
LangString OLLAMA_DOWNLOADING 1046 "Baixando Ollama..."
LangString OLLAMA_DOWNLOADING 1033 "Downloading Ollama..."
LangString OLLAMA_DOWNLOADING 3082 "Descargando Ollama..."

; DetailPrint: instalando
LangString OLLAMA_INSTALLING 1046 "Instalando Ollama..."
LangString OLLAMA_INSTALLING 1033 "Installing Ollama..."
LangString OLLAMA_INSTALLING 3082 "Instalando Ollama..."

; Sucesso
LangString OLLAMA_SUCCESS 1046 "Ollama instalado com sucesso."
LangString OLLAMA_SUCCESS 1033 "Ollama installed successfully."
LangString OLLAMA_SUCCESS 3082 "Ollama instalado correctamente."

; Erro na instalação do Ollama (código de saída)
LangString OLLAMA_ERR_INSTALL 1046 "A instalacao do Ollama nao foi concluida (codigo $1).$\nInstale manualmente em ollama.com apos abrir o Tusab."
LangString OLLAMA_ERR_INSTALL 1033 "Ollama installation did not complete (exit code $1).$\nPlease install it manually from ollama.com after launching Tusab."
LangString OLLAMA_ERR_INSTALL 3082 "La instalacion de Ollama no se completo (codigo $1).$\nInstalamelo manualmente desde ollama.com despues de abrir Tusab."

; Erro no download
LangString OLLAMA_ERR_DOWNLOAD 1046 "Nao foi possivel baixar o Ollama (erro: $0).$\nInstale manualmente em ollama.com apos abrir o Tusab."
LangString OLLAMA_ERR_DOWNLOAD 1033 "Could not download Ollama (error: $0).$\nPlease install it manually from ollama.com after launching Tusab."
LangString OLLAMA_ERR_DOWNLOAD 3082 "No se pudo descargar Ollama (error: $0).$\nInstalamelo manualmente desde ollama.com despues de abrir Tusab."

; DetailPrint: ignorado pelo usuário
LangString OLLAMA_SKIPPED 1046 "Instalacao do Ollama ignorada pelo usuario."
LangString OLLAMA_SKIPPED 1033 "Ollama installation skipped by user."
LangString OLLAMA_SKIPPED 3082 "Instalacion de Ollama omitida por el usuario."

; DetailPrint: já instalado
LangString OLLAMA_FOUND 1046 "Ollama ja instalado. Nenhuma acao necessaria."
LangString OLLAMA_FOUND 1033 "Ollama already installed. No action needed."
LangString OLLAMA_FOUND 3082 "Ollama ya esta instalado. No se requiere ninguna accion."

; ── Strings para o seletor de idioma ──────────────────────────────────────────

LangString LANG_SELECT_TITLE  1046 "Selecione o idioma do instalador"
LangString LANG_SELECT_TITLE  1033 "Select installer language"
LangString LANG_SELECT_TITLE  3082 "Seleccione el idioma del instalador"

; ── Limite de tamanho da pasta de instalação (invariante 25) ─────────────────
; O Python embutido tem arquivos a ~173 caracteres da raiz da instalação. Se
; pasta + esse caminho passar de 259 (MAX_PATH), o desinstalador da versão
; antiga não consegue apagá-los e a atualização automática trava, invisível,
; em "Falha ao desinstalar os arquivos do aplicativo antigo: 2" (testado em
; 20/out/2026). A pasta padrão (%LOCALAPPDATA%\Programs\tusab, ~40 caracteres)
; sempre cabe. O CI confere a conta a cada build lendo o valor abaixo
; (.github/scripts/verificar-backend-empacotado.ps1) — mudar só aqui.
; Não afeta update nem instalação silenciosa: .onVerifyInstDir só roda na
; página de escolha de pasta.

!define TUSAB_MAX_INSTDIR 75

!ifndef BUILD_UNINSTALLER
  LangString TUSAB_DIR_TOP 1046 "O Tusab sera instalado na pasta abaixo.$\r$\n$\r$\nO caminho da pasta pode ter no maximo ${TUSAB_MAX_INSTDIR} caracteres (por exemplo, C:\Tusab). Caminhos mais longos impedem a atualizacao automatica do Windows; nesse caso o botao Instalar fica desativado."
  LangString TUSAB_DIR_TOP 1033 "Tusab will be installed in the folder below.$\r$\n$\r$\nThe folder path can have at most ${TUSAB_MAX_INSTDIR} characters (for example, C:\Tusab). Longer paths break automatic updates on Windows; in that case the Install button is disabled."
  LangString TUSAB_DIR_TOP 3082 "Tusab se instalara en la carpeta de abajo.$\r$\n$\r$\nLa ruta de la carpeta puede tener como maximo ${TUSAB_MAX_INSTDIR} caracteres (por ejemplo, C:\Tusab). Las rutas mas largas impiden la actualizacion automatica en Windows; en ese caso el boton Instalar queda desactivado."
  !define MUI_DIRECTORYPAGE_TEXT_TOP "$(TUSAB_DIR_TOP)"

  ; Abort aqui desativa o botão Instalar da página de pasta (não fecha nada).
  Function .onVerifyInstDir
    Push $0
    StrLen $0 $INSTDIR
    IntCmp $0 ${TUSAB_MAX_INSTDIR} tusab_dir_ok tusab_dir_ok
    Pop $0
    Abort
    tusab_dir_ok:
    Pop $0
  FunctionEnd
!endif

; ── Seletor de idioma exibido no início da instalação ────────────────────────
; customInit é chamado pelo electron-builder antes das páginas do instalador.
; LangDLL::LangDialog abre um dropdown com os idiomas declarados em installerLanguages.

!macro customInit
  LangDLL::LangDialog "$(LANG_SELECT_TITLE)" "$(LANG_SELECT_TITLE)"
  Pop $LANGUAGE
  ${If} $LANGUAGE == "cancel"
    Abort
  ${EndIf}
!macroend

; ── Hook principal ─────────────────────────────────────────────────────────────

!macro customInstall
  ; Verifica se ollama.exe já existe nas localizações padrão
  IfFileExists "$LOCALAPPDATA\Programs\Ollama\ollama.exe" ollama_ok check_prog_files
  check_prog_files:
  IfFileExists "$PROGRAMFILES64\Ollama\ollama.exe" ollama_ok prompt_ollama
  prompt_ollama:

  ; Ollama não encontrado — pergunta ao usuário no idioma correto
  MessageBox MB_YESNO|MB_ICONQUESTION "$(OLLAMA_ASK)" IDNO ollama_skip

  ; Usuário aceitou — baixa OllamaSetup.exe
  DetailPrint "$(OLLAMA_DOWNLOADING)"
  inetc::get /CAPTION "$(OLLAMA_DL_CAPTION)" /BANNER "$(OLLAMA_DL_BANNER)" \
    "https://github.com/ollama/ollama/releases/latest/download/OllamaSetup.exe" \
    "$TEMP\OllamaSetup.exe" /END
  Pop $0
  ${If} $0 == "OK"
    DetailPrint "$(OLLAMA_INSTALLING)"
    ExecWait '"$TEMP\OllamaSetup.exe" /S' $1
    ${If} $1 == 0
      DetailPrint "$(OLLAMA_SUCCESS)"
    ${Else}
      MessageBox MB_OK|MB_ICONEXCLAMATION "$(OLLAMA_ERR_INSTALL)"
    ${EndIf}
    Delete "$TEMP\OllamaSetup.exe"
  ${Else}
    MessageBox MB_OK|MB_ICONEXCLAMATION "$(OLLAMA_ERR_DOWNLOAD)"
  ${EndIf}
  Goto ollama_done

  ollama_skip:
  DetailPrint "$(OLLAMA_SKIPPED)"
  Goto ollama_done

  ollama_ok:
  DetailPrint "$(OLLAMA_FOUND)"

  ollama_done:
!macroend
