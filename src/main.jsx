import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { Plus, Search, Save, Printer, Copy, Pencil, EyeOff, Eye, Trash2, RefreshCw, FileText } from 'lucide-react';
import './style.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

function moeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function hojeBR() {
  return new Date().toLocaleDateString('pt-BR');
}

function parseValor(valor) {
  if (typeof valor === 'number') return valor;
  return Number(String(valor || '0').replace(/\./g, '').replace(',', '.')) || 0;
}

function normalizar(texto) {
  return String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function App() {
  const [titulo, setTitulo] = useState(`Saldos das Contas - ${hojeBR()}`);
  const [subtitulo, setSubtitulo] = useState('Controle diário de saldos das contas da prefeitura');
  const [categorias, setCategorias] = useState([]);
  const [contas, setContas] = useState([]);
  const [busca, setBusca] = useState('');
  const [novaCategoria, setNovaCategoria] = useState('');
  const [mostrarInativas, setMostrarInativas] = useState(false);
  const [editandoContaId, setEditandoContaId] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const [filtroBanco, setFiltroBanco] = useState('todos');
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  const [ordenacao, setOrdenacao] = useState('nome');
  const [categoriaRelatorio, setCategoriaRelatorio] = useState('todas');

  const [formConta, setFormConta] = useState({
    banco: '',
    agencia: '',
    conta: '',
    nome: '',
    categoria_id: '',
    saldo: '',
    observacao: ''
  });

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setErro('');
    if (!supabase) {
      setErro('Configure as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY na Vercel.');
      return;
    }

    setCarregando(true);
    const { data: cats, error: erroCats } = await supabase.from('categorias').select('*').order('nome');
    const { data: ctas, error: erroContas } = await supabase.from('contas').select('*, categorias(nome)').order('nome');

    if (erroCats || erroContas) {
      setErro('Erro ao carregar dados. Confira se executou o supabase.sql.');
    } else {
      setCategorias(cats || []);
      setContas(ctas || []);
      if (!formConta.categoria_id && cats?.length) {
        setFormConta((atual) => ({ ...atual, categoria_id: cats.find(c => c.ativo)?.id || cats[0].id }));
      }
    }
    setCarregando(false);
  }

  const categoriasAtivas = categorias.filter(c => c.ativo);

  const bancos = useMemo(() => {
    const lista = contas.filter(c => c.ativa).map(c => c.banco).filter(Boolean);
    return [...new Set(lista)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [contas]);

  const contasFiltradas = useMemo(() => {
    const termo = normalizar(busca.trim());

    const filtradas = contas
      .filter(conta => mostrarInativas ? true : conta.ativa)
      .filter(conta => filtroBanco === 'todos' ? true : conta.banco === filtroBanco)
      .filter(conta => filtroCategoria === 'todos' ? true : conta.categoria_id === filtroCategoria)
      .filter(conta => {
        const categoriaNome = conta.categorias?.nome || '';
        return normalizar([conta.banco, conta.agencia, conta.conta, conta.nome, categoriaNome, conta.observacao].join(' ')).includes(termo);
      });

    return [...filtradas].sort((a, b) => {
      const categoriaA = a.categorias?.nome || '';
      const categoriaB = b.categorias?.nome || '';
      if (ordenacao === 'banco') return String(a.banco || '').localeCompare(String(b.banco || ''), 'pt-BR') || String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
      if (ordenacao === 'categoria') return categoriaA.localeCompare(categoriaB, 'pt-BR') || String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
      if (ordenacao === 'maior-saldo') return Number(b.saldo || 0) - Number(a.saldo || 0);
      if (ordenacao === 'menor-saldo') return Number(a.saldo || 0) - Number(b.saldo || 0);
      return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
    });
  }, [busca, contas, mostrarInativas, filtroBanco, filtroCategoria, ordenacao]);

  const totalGeral = useMemo(() => contas.filter(c => c.ativa).reduce((soma, conta) => soma + Number(conta.saldo || 0), 0), [contas]);

  const totaisPorCategoria = useMemo(() => {
    return categorias.filter(cat => cat.ativo).map(cat => {
      const lista = contas.filter(conta => conta.ativa && conta.categoria_id === cat.id);
      return {
        ...cat,
        total: lista.reduce((soma, conta) => soma + Number(conta.saldo || 0), 0),
        quantidade: lista.length
      };
    });
  }, [categorias, contas]);

  const contasRelatorioCategoria = useMemo(() => {
    if (categoriaRelatorio === 'todas') return [];
    return contas
      .filter(conta => conta.ativa && conta.categoria_id === categoriaRelatorio)
      .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
  }, [contas, categoriaRelatorio]);

  const categoriaSelecionadaRelatorio = categorias.find(c => c.id === categoriaRelatorio);
  const totalRelatorioCategoria = contasRelatorioCategoria.reduce((soma, conta) => soma + Number(conta.saldo || 0), 0);

  function limparFormulario() {
    setFormConta({
      banco: '',
      agencia: '',
      conta: '',
      nome: '',
      categoria_id: categoriasAtivas[0]?.id || '',
      saldo: '',
      observacao: ''
    });
    setEditandoContaId(null);
  }

  async function salvarConta() {
    if (!formConta.nome.trim()) {
      alert('Informe o nome da conta.');
      return;
    }

    const dados = {
      banco: formConta.banco.trim(),
      agencia: formConta.agencia.trim(),
      conta: formConta.conta.trim(),
      nome: formConta.nome.trim(),
      categoria_id: formConta.categoria_id || null,
      saldo: parseValor(formConta.saldo),
      observacao: formConta.observacao.trim(),
      atualizado_em: new Date().toISOString()
    };

    if (editandoContaId) {
      const { error } = await supabase.from('contas').update(dados).eq('id', editandoContaId);
      if (error) return alert('Erro ao atualizar conta.');
      await supabase.from('historico_saldos').insert({ conta_id: editandoContaId, saldo: dados.saldo });
    } else {
      const { data, error } = await supabase.from('contas').insert({ ...dados, ativa: true }).select().single();
      if (error) return alert('Erro ao criar conta.');
      await supabase.from('historico_saldos').insert({ conta_id: data.id, saldo: dados.saldo });
    }

    limparFormulario();
    carregarDados();
  }

  function editarConta(conta) {
    setEditandoContaId(conta.id);
    setFormConta({
      banco: conta.banco || '',
      agencia: conta.agencia || '',
      conta: conta.conta || '',
      nome: conta.nome || '',
      categoria_id: conta.categoria_id || '',
      saldo: String(conta.saldo || '').replace('.', ','),
      observacao: conta.observacao || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function alternarConta(conta) {
    const { error } = await supabase.from('contas').update({ ativa: !conta.ativa }).eq('id', conta.id);
    if (error) return alert('Erro ao alterar situação da conta.');
    carregarDados();
  }

  async function adicionarCategoria() {
    const nome = novaCategoria.trim();
    if (!nome) return;

    const { error } = await supabase.from('categorias').insert({ nome, ativo: true });
    if (error) return alert('Erro ao criar categoria. Veja se ela já existe.');
    setNovaCategoria('');
    carregarDados();
  }

  async function alternarCategoria(cat) {
    const temContaAtiva = contas.some(conta => conta.categoria_id === cat.id && conta.ativa);
    if (cat.ativo && temContaAtiva) {
      alert('Essa categoria possui contas ativas. Para ocultar, primeiro inative ou mova as contas dessa categoria.');
      return;
    }

    const { error } = await supabase.from('categorias').update({ ativo: !cat.ativo }).eq('id', cat.id);
    if (error) return alert('Erro ao alterar categoria.');
    carregarDados();
  }

  async function excluirCategoria(cat) {
    const temConta = contas.some(conta => conta.categoria_id === cat.id);
    if (temConta) {
      alert('Não dá para excluir uma categoria com contas vinculadas. Mova ou inative as contas primeiro. Use ocultar quando quiser apenas tirar da tela.');
      return;
    }

    const confirmar = confirm(`Excluir permanentemente a categoria "${cat.nome}"?`);
    if (!confirmar) return;

    const { error } = await supabase.from('categorias').delete().eq('id', cat.id);
    if (error) return alert('Erro ao excluir categoria.');
    carregarDados();
  }

  function relatorioTextoGeral() {
    const linhas = [titulo, subtitulo, ''];
    totaisPorCategoria.forEach(cat => linhas.push(`${cat.nome}: ${moeda(cat.total)}`));
    linhas.push('', `Total Geral: ${moeda(totalGeral)}`);
    return linhas.join('\n');
  }

  function relatorioTextoCategoria() {
    if (!categoriaSelecionadaRelatorio) return '';

    const linhas = [`Relatório - ${categoriaSelecionadaRelatorio.nome}`, subtitulo, ''];

    contasRelatorioCategoria.forEach(conta => {
      linhas.push(`Conta: ${conta.nome}`);
      if (conta.banco) linhas.push(`Banco: ${conta.banco}`);
      if (conta.agencia) linhas.push(`Agência: ${conta.agencia}`);
      if (conta.conta) linhas.push(`Número: ${conta.conta}`);
      linhas.push(`Saldo: ${moeda(conta.saldo)}`);
      if (conta.observacao) linhas.push(`Obs.: ${conta.observacao}`);
      linhas.push('');
    });

    linhas.push(`Total ${categoriaSelecionadaRelatorio.nome}: ${moeda(totalRelatorioCategoria)}`);
    return linhas.join('\n');
  }

  async function copiarRelatorioGeral() {
    await navigator.clipboard.writeText(relatorioTextoGeral());
    alert('Relatório geral copiado.');
  }

  async function copiarRelatorioCategoria() {
    if (!categoriaSelecionadaRelatorio) return alert('Selecione uma categoria.');
    await navigator.clipboard.writeText(relatorioTextoCategoria());
    alert('Relatório da categoria copiado.');
  }

  function imprimirRelatorioCategoria() {
    if (!categoriaSelecionadaRelatorio) {
      alert('Selecione uma categoria.');
      return;
    }

    const conteudo = relatorioTextoCategoria().replace(/\n/g, '<br>');
    const janela = window.open('', '_blank');
    janela.document.write(`
      <html>
        <head>
          <title>Relatório - ${categoriaSelecionadaRelatorio.nome}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            .box { font-size: 14px; line-height: 1.55; }
          </style>
        </head>
        <body>
          <div class="box">${conteudo}</div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    janela.document.close();
  }

  return (
    <main className="app">
      <section className="cabecalho">
        <input className="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        <input className="subtitulo" value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} />
      </section>

      {erro && <div className="alerta">{erro}</div>}

      <section className="cards">
        <div className="card"><span>Total Geral</span><strong>{moeda(totalGeral)}</strong></div>
        <div className="card"><span>Contas Ativas</span><strong>{contas.filter(c => c.ativa).length}</strong></div>
        <div className="card"><span>Categorias</span><strong>{categoriasAtivas.length}</strong></div>
        <div className="card"><span>Atualização</span><strong>{hojeBR()}</strong></div>
      </section>

      <section className="grid-form no-print">
        <div className="painel painel-grande">
          <h2>{editandoContaId ? 'Editar Conta' : 'Adicionar Conta'}</h2>
          <div className="form-grid">
            <input placeholder="Banco" value={formConta.banco} onChange={(e) => setFormConta({ ...formConta, banco: e.target.value })} />
            <input placeholder="Agência" value={formConta.agencia} onChange={(e) => setFormConta({ ...formConta, agencia: e.target.value })} />
            <input placeholder="Conta" value={formConta.conta} onChange={(e) => setFormConta({ ...formConta, conta: e.target.value })} />
            <input placeholder="Nome da conta" value={formConta.nome} onChange={(e) => setFormConta({ ...formConta, nome: e.target.value })} />
            <select value={formConta.categoria_id} onChange={(e) => setFormConta({ ...formConta, categoria_id: e.target.value })}>
              <option value="">Selecione uma categoria</option>
              {categoriasAtivas.map(cat => <option key={cat.id} value={cat.id}>{cat.nome}</option>)}
            </select>
            <input placeholder="Saldo atual" value={formConta.saldo} onChange={(e) => setFormConta({ ...formConta, saldo: e.target.value })} />
            <input className="col-span" placeholder="Observação" value={formConta.observacao} onChange={(e) => setFormConta({ ...formConta, observacao: e.target.value })} />
          </div>
          <div className="botoes">
            <button className="primario" onClick={salvarConta}><Save size={18} /> Salvar conta</button>
            {editandoContaId && <button onClick={limparFormulario}>Cancelar edição</button>}
          </div>
        </div>

        <div className="painel">
          <h2>Categorias</h2>
          <div className="linha-add">
            <input placeholder="Nova categoria" value={novaCategoria} onChange={(e) => setNovaCategoria(e.target.value)} />
            <button className="primario" onClick={adicionarCategoria}><Plus size={18} /></button>
          </div>
          <div className="lista-categorias">
            {categorias.map(cat => (
              <div className="categoria" key={cat.id}>
                <span className={cat.ativo ? '' : 'inativo'}>{cat.nome}</span>
                <div className="acoes-categoria">
                  <button title="Ocultar/Reativar" onClick={() => alternarCategoria(cat)}>{cat.ativo ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  <button title="Excluir categoria" onClick={() => excluirCategoria(cat)}><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="painel no-print">
        <h2><FileText size={20} /> Relatório por Categoria</h2>
        <div className="relatorio-categoria">
          <select value={categoriaRelatorio} onChange={(e) => setCategoriaRelatorio(e.target.value)}>
            <option value="todas">Selecione uma categoria</option>
            {categoriasAtivas.map(cat => <option key={cat.id} value={cat.id}>{cat.nome}</option>)}
          </select>
          <button onClick={copiarRelatorioCategoria}><Copy size={18} /> Copiar categoria</button>
          <button className="primario" onClick={imprimirRelatorioCategoria}><Printer size={18} /> Imprimir categoria</button>
        </div>
        {categoriaSelecionadaRelatorio && (
          <div className="resumo-relatorio">
            <strong>{categoriaSelecionadaRelatorio.nome}</strong>
            <span>{contasRelatorioCategoria.length} conta(s)</span>
            <span>Total: {moeda(totalRelatorioCategoria)}</span>
          </div>
        )}
      </section>

      <section className="painel">
        <div className="barra no-print">
          <div className="busca">
            <Search size={18} />
            <input placeholder="Buscar conta, banco, categoria..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>

          <select value={filtroBanco} onChange={(e) => setFiltroBanco(e.target.value)} className="select-filtro">
            <option value="todos">Todos os bancos</option>
            {bancos.map(banco => <option key={banco} value={banco}>{banco}</option>)}
          </select>

          <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="select-filtro">
            <option value="todos">Todas as categorias</option>
            {categoriasAtivas.map(cat => <option key={cat.id} value={cat.id}>{cat.nome}</option>)}
          </select>

          <select value={ordenacao} onChange={(e) => setOrdenacao(e.target.value)} className="select-filtro">
            <option value="nome">Ordem alfabética</option>
            <option value="banco">Banco</option>
            <option value="categoria">Categoria</option>
            <option value="maior-saldo">Maior saldo</option>
            <option value="menor-saldo">Menor saldo</option>
          </select>

          <button onClick={carregarDados}><RefreshCw size={18} /> Atualizar</button>
          <button onClick={() => setMostrarInativas(!mostrarInativas)}>{mostrarInativas ? 'Ocultar inativas' : 'Mostrar inativas'}</button>
          <button onClick={copiarRelatorioGeral}><Copy size={18} /> WhatsApp geral</button>
          <button className="primario" onClick={() => window.print()}><Printer size={18} /> Imprimir/PDF geral</button>
        </div>

        <div className="totais-categorias">
          {totaisPorCategoria.map(cat => (
            <div className="mini-card" key={cat.id}>
              <strong>{cat.nome}</strong>
              <span>{moeda(cat.total)}</span>
              <small>{cat.quantidade} conta(s)</small>
            </div>
          ))}
        </div>

        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Banco</th>
                <th>Agência</th>
                <th>Conta</th>
                <th>Nome</th>
                <th className="direita">Saldo</th>
                <th className="no-print">Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr><td colSpan="7">Carregando...</td></tr>
              ) : contasFiltradas.length === 0 ? (
                <tr><td colSpan="7">Nenhuma conta cadastrada.</td></tr>
              ) : contasFiltradas.map(conta => (
                <tr key={conta.id} className={conta.ativa ? '' : 'linha-inativa'}>
                  <td>{conta.categorias?.nome || '-'}</td>
                  <td>{conta.banco}</td>
                  <td>{conta.agencia}</td>
                  <td>{conta.conta}</td>
                  <td>{conta.nome}</td>
                  <td className="direita saldo">{moeda(conta.saldo)}</td>
                  <td className="acoes no-print">
                    <button onClick={() => editarConta(conta)}><Pencil size={16} /></button>
                    <button onClick={() => alternarConta(conta)}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
