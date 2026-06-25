; installer.nsh — Hook NSIS injetado pelo electron-builder
; Detecta Ollama e oferece instalar antes do Tusab terminar de instalar.
; electron-builder injeta este arquivo automaticamente se estiver em build_resources/

!macro customInstall
  ; Verifica se ollama.exe já existe nas localizações padrão
  IfFileExists "$LOCALAPPDATA\Programs\Ollama\ollama.exe" ollama_ok check_prog_files
  check_prog_files:
  IfFileExists "$PROGRAMFILES64\Ollama\ollama.exe" ollama_ok prompt_ollama
  prompt_ollama:

  ; Ollama não encontrado — pergunta ao usuário
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "O Tusab usa o Ollama para rodar IA direto no seu computador.$\n$\nO Ollama nao foi detectado. Deseja baixar e instalar agora? (~50 MB)$\n$\nVoce pode pular esta etapa e instalar o Ollama depois em ollama.com" \
    IDNO ollama_skip

  ; Usuário aceitou — baixa OllamaSetup.exe
  DetailPrint "Baixando Ollama..."
  inetc::get /CAPTION "Baixando Ollama" /BANNER "Aguarde enquanto o Ollama e baixado..." \
    "https://github.com/ollama/ollama/releases/latest/download/OllamaSetup.exe" \
    "$TEMP\OllamaSetup.exe" /END
  Pop $0
  ${If} $0 == "OK"
    DetailPrint "Instalando Ollama..."
    ExecWait '"$TEMP\OllamaSetup.exe" /S' $1
    ${If} $1 == 0
      DetailPrint "Ollama instalado com sucesso."
    ${Else}
      MessageBox MB_OK|MB_ICONEXCLAMATION \
        "A instalacao do Ollama nao foi concluida (codigo $1).$\nInstale manualmente em ollama.com apos abrir o Tusab."
    ${EndIf}
    Delete "$TEMP\OllamaSetup.exe"
  ${Else}
    MessageBox MB_OK|MB_ICONEXCLAMATION \
      "Nao foi possivel baixar o Ollama (erro: $0).$\nInstale manualmente em ollama.com apos abrir o Tusab."
  ${EndIf}
  Goto ollama_done

  ollama_skip:
  DetailPrint "Instalacao do Ollama ignorada pelo usuario."
  Goto ollama_done

  ollama_ok:
  DetailPrint "Ollama ja instalado. Nenhuma acao necessaria."

  ollama_done:
!macroend
