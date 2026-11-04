# File Manager

Aplicativo desktop local em Vue 3, TypeScript e Electron para encontrar fotos e vídeos duplicados ou visualmente semelhantes, inclusive em resoluções e níveis de compressão diferentes.

## Desenvolvimento

Requer Node.js 22.12 ou superior (Node 22 LTS recomendado) e npm.

```sh
npm install
npm run dev
```

O comando inicia o Vite e abre a janela do Electron. Alterações na interface Vue aparecem com hot reload. Use **Ctrl + Shift + I** para abrir o DevTools durante o desenvolvimento. Abrir apenas o endereço do Vite no navegador não disponibiliza as operações de arquivos.

1. Digite o caminho completo da pasta ou use **Procurar pasta**, que permite selecionar várias pastas. Use **Adicionar pasta** para incluir mais caminhos manualmente e o botão de remover para retirar uma entrada.
2. Clique em **Analisar arquivos**. Os arquivos de todas as pastas são comparados juntos. A busca inclui todas as subpastas reais; links simbólicos e junções não são seguidos. Pastas repetidas ou contidas em outra selecionada são analisadas uma única vez. Campos vazios são ignorados; caminhos inválidos impedem o início da análise.
3. Selecione um grupo para comparar as versões, as resoluções e os tamanhos. Os cards usam miniaturas independentes dos originais. Clique na imagem para ampliar ou na miniatura do vídeo para reproduzir, quando o codec for suportado pelo Chromium. Marcar um arquivo para a lixeira não abre o original.
4. Marque manualmente os arquivos que deseja enviar à lixeira e confirme no diálogo do sistema. É obrigatório manter pelo menos uma cópia disponível em cada grupo.

A análise não altera os arquivos. Arquivos sem permissão, danificados ou sem suporte de decodificação são informados ao final. Não há exclusão permanente como alternativa quando a lixeira falha.

## Como a comparação funciona

- SHA-256 encontra cópias binariamente idênticas entre os arquivos de mídia decodificados com sucesso.
- Fotos são normalizadas por orientação, convertidas para tons de cinza e comparadas com um hash perceptual DCT de 63 bits. A distância máxima é de sete bits, com verificação de proporção.
- Vídeos são inspecionados pelo FFprobe. O FFmpeg extrai frames em 10%, 30%, 50%, 70% e 90% da duração. A comparação exige duração próxima, ao menos quatro frames semelhantes e distância média dentro do limite.
- Um índice por segmentos da assinatura reduz as comparações desnecessárias. Cada grupo compara suas versões diretamente com uma referência, evitando encadear arquivos progressivamente diferentes.
- Imagens ou frames praticamente uniformes participam somente da comparação exata para reduzir falsos positivos.

Similaridade é uma indicação para revisão, não prova de equivalência. Fotos em sequência podem aparecer juntas. Cortes, espelhamento, edições fortes e vídeos com trechos removidos podem não ser encontrados. A análise de vídeo compara a imagem, **não o áudio**. A referência de maior resolução não garante maior qualidade.

Extensões candidatas de imagem: JPG, JPEG, PNG, WebP, AVIF, TIFF, GIF, HEIC e HEIF. HEIC/HEIF e alguns codecs dependem do suporte disponível na distribuição do Sharp/FFmpeg; falhas são listadas. GIFs são comparados pelo primeiro frame. Vídeos: MP4, MOV, MKV, AVI, WebM, M4V, MTS e M2TS. O suporte de reprodução na interface é mais restrito que o de análise; use **Mostrar na pasta** quando necessário.

Nesta versão, as análises não são persistidas: cada execução recalcula as assinaturas. Miniaturas temporárias são criadas fora da pasta analisada. A análise roda em uma worker thread separada da interface e pode ser cancelada. Arquivos de mídia são processados um por vez para controlar memória e carga.

Na análise de imagens, o arquivo é lido para um buffer e fechado antes de ser processado pelo Sharp. Isso evita que o cache nativo retenha um arquivo original aberto. A visualização ampliada também recebe os dados de uma leitura concluída, em vez de manter um stream do JPEG aberto. Os streams de vídeo são liberados antes de enviar arquivos à lixeira.

## Comandos

```sh
npm run typecheck
npm test
npm run test:desktop
npm run build
npm run pack
npm run dist:win
```

`pack` gera a pasta do aplicativo em `release/`; `dist:win` gera o instalador Windows. O Node e os binários de FFmpeg/FFprobe são incluídos na distribuição. A compilação de distribuição deve ser feita no sistema/arquitetura de destino para incluir os binários correspondentes. O instalador inicial não possui certificado de assinatura.

`test:desktop` abre uma janela real do Electron e testa o fluxo completo com arquivos gerados temporariamente. O teste confirma o cancelamento da lixeira, simula uma falha do Windows seguida de nova tentativa e envia uma imagem e um vídeo em reprodução à lixeira para validar a operação; não utiliza pastas pessoais. Screenshots são salvos em `.test-output/`.

## Estrutura

- `src/main`: janela, operações locais, análise e comparação.
- `src/preload`: ponte com operações específicas expostas à interface.
- `src/renderer/src`: componentes Vue e estilos SCSS.
- `src/shared`: contratos TypeScript entre processos.
- `tests`: comparação perceptual e análise real com fotos/vídeos gerados pelos testes.

O renderer usa isolamento de contexto, sandbox e não recebe acesso direto ao Node. Acesso a prévias e operações de lixeira são limitados aos arquivos da análise atual. A aplicação verifica tamanho e data de modificação antes de enviar à lixeira e exige confirmação nativa.

## Distribuição e licenças

As ferramentas não cobram por arquivo analisado. Antes de distribuir publicamente, inclua os avisos e licenças de terceiros e confira as obrigações dos binários de FFmpeg/FFprobe incluídos. A distribuição do `ffmpeg-static` pode usar componentes GPL; não presuma que qualquer build do FFmpeg seja LGPL. Consulte [FFmpeg](https://ffmpeg.org/legal.html), [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static) e [ffprobe-static](https://github.com/joshwnj/ffprobe-static).
